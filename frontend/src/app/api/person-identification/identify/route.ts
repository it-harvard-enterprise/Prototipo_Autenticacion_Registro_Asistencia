import { NextRequest, NextResponse } from "next/server";

import { ensureApprovedAdmin } from "@/lib/auth/approved-admin";
import {
  biometricBackendConfigHint,
  resolveBiometricBackendBaseUrl,
} from "@/lib/biometric-backend";
import { createClient } from "@/lib/supabase/server";

type IdentifyMode = "id" | "fingerprint";

type IdentifyRequestBody = {
  mode?: IdentifyMode;
  numeroIdentificacion?: string;
  fingerprintTemplate?: string;
};

type BackendFingerprintResponse = {
  success: boolean;
  numero_identificacion?: string;
  confidence?: number;
  error?: string;
};

type CourseInfo = {
  id_curso: number;
  nombre_curso: string;
  nivel_curso: string;
  salon: string | null;
  hora_inicio: string;
  hora_fin: string;
  fecha_inicio: string;
  fecha_fin: string;
};

type PersonRecord = {
  role: "ESTUDIANTE" | "PROFESOR";
  tipo_identificacion: string | null;
  numero_identificacion: string;
  nombres: string;
  apellidos: string;
  cursos: CourseInfo[];
};

type PersonLookupResult = {
  found: boolean;
  numero_identificacion: string;
  records: PersonRecord[];
};

function normalizeId(value: string | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function normalizeCourse(raw: unknown): CourseInfo | null {
  if (!raw || typeof raw !== "object") return null;

  const row = raw as {
    id_curso?: unknown;
    nombre_curso?: unknown;
    nivel_curso?: unknown;
    salon?: unknown;
    hora_inicio?: unknown;
    hora_fin?: unknown;
    fecha_inicio?: unknown;
    fecha_fin?: unknown;
  };

  if (
    typeof row.id_curso !== "number" ||
    typeof row.nombre_curso !== "string" ||
    typeof row.nivel_curso !== "string" ||
    typeof row.hora_inicio !== "string" ||
    typeof row.hora_fin !== "string" ||
    typeof row.fecha_inicio !== "string" ||
    typeof row.fecha_fin !== "string"
  ) {
    return null;
  }

  return {
    id_curso: row.id_curso,
    nombre_curso: row.nombre_curso,
    nivel_curso: row.nivel_curso,
    salon: typeof row.salon === "string" ? row.salon : null,
    hora_inicio: row.hora_inicio,
    hora_fin: row.hora_fin,
    fecha_inicio: row.fecha_inicio,
    fecha_fin: row.fecha_fin,
  };
}

function normalizeEmbeddedCourse(raw: unknown): CourseInfo | null {
  if (Array.isArray(raw)) {
    return normalizeCourse(raw[0]);
  }

  return normalizeCourse(raw);
}

function sortCourses(courses: CourseInfo[]): CourseInfo[] {
  return [...courses].sort((a, b) => {
    if (a.id_curso !== b.id_curso) return a.id_curso - b.id_curso;
    return a.nombre_curso.localeCompare(b.nombre_curso);
  });
}

async function lookupPersonById(
  numeroIdentificacion: string,
): Promise<PersonLookupResult> {
  const supabase = await createClient();

  const [
    studentQuery,
    professorQuery,
    studentCoursesQuery,
    professorCoursesQuery,
  ] = await Promise.all([
    supabase
      .from("estudiantes")
      .select("numero_identificacion, tipo_identificacion, nombres, apellidos")
      .eq("numero_identificacion", numeroIdentificacion)
      .maybeSingle(),
    supabase
      .from("profesores")
      .select("numero_identificacion, tipo_identificacion, nombres, apellidos")
      .eq("numero_identificacion", numeroIdentificacion)
      .maybeSingle(),
    supabase
      .from("cursos_x_estudiantes")
      .select(
        "id_curso, cursos(id_curso, nombre_curso, nivel_curso, salon, hora_inicio, hora_fin, fecha_inicio, fecha_fin)",
      )
      .eq("numero_identificacion", numeroIdentificacion),
    supabase
      .from("cursos_x_profesores")
      .select(
        "id_curso, cursos(id_curso, nombre_curso, nivel_curso, salon, hora_inicio, hora_fin, fecha_inicio, fecha_fin)",
      )
      .eq("numero_identificacion", numeroIdentificacion),
  ]);

  if (studentQuery.error) {
    throw new Error(studentQuery.error.message);
  }

  if (professorQuery.error) {
    throw new Error(professorQuery.error.message);
  }

  if (studentCoursesQuery.error) {
    throw new Error(studentCoursesQuery.error.message);
  }

  if (professorCoursesQuery.error) {
    throw new Error(professorCoursesQuery.error.message);
  }

  const records: PersonRecord[] = [];

  if (studentQuery.data) {
    const courses = (studentCoursesQuery.data ?? [])
      .map((row) =>
        normalizeEmbeddedCourse((row as { cursos?: unknown }).cursos),
      )
      .filter((course): course is CourseInfo => Boolean(course));

    records.push({
      role: "ESTUDIANTE",
      tipo_identificacion: studentQuery.data.tipo_identificacion ?? null,
      numero_identificacion: studentQuery.data.numero_identificacion,
      nombres: studentQuery.data.nombres,
      apellidos: studentQuery.data.apellidos,
      cursos: sortCourses(courses),
    });
  }

  if (professorQuery.data) {
    const courses = (professorCoursesQuery.data ?? [])
      .map((row) =>
        normalizeEmbeddedCourse((row as { cursos?: unknown }).cursos),
      )
      .filter((course): course is CourseInfo => Boolean(course));

    records.push({
      role: "PROFESOR",
      tipo_identificacion: professorQuery.data.tipo_identificacion ?? null,
      numero_identificacion: professorQuery.data.numero_identificacion,
      nombres: professorQuery.data.nombres,
      apellidos: professorQuery.data.apellidos,
      cursos: sortCourses(courses),
    });
  }

  return {
    found: records.length > 0,
    numero_identificacion: numeroIdentificacion,
    records,
  };
}

async function identifyByFingerprint(
  request: NextRequest,
  fingerprintTemplate: string,
): Promise<{
  success: boolean;
  found: boolean;
  confidence?: number;
  numero_identificacion?: string;
  error?: string;
}> {
  const backendUrl = resolveBiometricBackendBaseUrl();
  if (!backendUrl) {
    return {
      success: false,
      found: false,
      error: `No se ha configurado la URL del backend biometrico. ${biometricBackendConfigHint()}`,
    };
  }

  const backendAccessKey = process.env.BIOMETRIC_BACKEND_ACCESS_KEY?.trim();
  const frontendOrigin = request.nextUrl.origin;

  try {
    const response = await fetch(
      `${backendUrl}/api/person/identify-by-fingerprint`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Frontend-Origin": frontendOrigin,
          ...(backendAccessKey
            ? {
                "X-Backend-Access-Key": backendAccessKey,
              }
            : {}),
        },
        body: JSON.stringify({
          fingerprint_template: fingerprintTemplate,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );

    const payload = (await response
      .json()
      .catch(() => null)) as BackendFingerprintResponse | null;

    if (!response.ok) {
      return {
        success: false,
        found: false,
        error:
          payload?.error ?? `Error del backend biometrico: ${response.status}`,
      };
    }

    if (!payload?.success) {
      return {
        success: false,
        found: false,
        error: payload?.error ?? "No fue posible validar la huella",
      };
    }

    if (!payload.numero_identificacion) {
      return {
        success: true,
        found: false,
        confidence: payload.confidence,
      };
    }

    return {
      success: true,
      found: true,
      numero_identificacion: payload.numero_identificacion,
      confidence: payload.confidence,
    };
  } catch {
    return {
      success: false,
      found: false,
      error: `No fue posible conectar con el backend biometrico configurado (${backendUrl}).`,
    };
  }
}

export async function POST(request: NextRequest) {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return NextResponse.json(
      {
        success: false,
        found: false,
        error: approval.error,
      },
      { status: 401 },
    );
  }

  const body = (await request
    .json()
    .catch(() => null)) as IdentifyRequestBody | null;

  const mode = body?.mode;
  if (mode !== "id" && mode !== "fingerprint") {
    return NextResponse.json(
      {
        success: false,
        found: false,
        error: "mode invalido",
      },
      { status: 400 },
    );
  }

  try {
    if (mode === "id") {
      const numeroIdentificacion = normalizeId(body?.numeroIdentificacion);
      if (!numeroIdentificacion) {
        return NextResponse.json(
          {
            success: false,
            found: false,
            error: "numeroIdentificacion es requerido",
          },
          { status: 400 },
        );
      }

      const person = await lookupPersonById(numeroIdentificacion);
      return NextResponse.json({
        success: true,
        mode,
        found: person.found,
        person,
      });
    }

    const fingerprintTemplate = (body?.fingerprintTemplate ?? "").trim();
    if (!fingerprintTemplate) {
      return NextResponse.json(
        {
          success: false,
          found: false,
          error: "fingerprintTemplate es requerido",
        },
        { status: 400 },
      );
    }

    const identifyResult = await identifyByFingerprint(
      request,
      fingerprintTemplate,
    );
    if (!identifyResult.success) {
      return NextResponse.json(
        {
          success: false,
          mode,
          found: false,
          error: identifyResult.error,
        },
        { status: 502 },
      );
    }

    if (!identifyResult.found || !identifyResult.numero_identificacion) {
      return NextResponse.json({
        success: true,
        mode,
        found: false,
        confidence: identifyResult.confidence,
      });
    }

    const person = await lookupPersonById(identifyResult.numero_identificacion);

    return NextResponse.json({
      success: true,
      mode,
      found: person.found,
      confidence: identifyResult.confidence,
      person,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        found: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible identificar a la persona",
      },
      { status: 500 },
    );
  }
}
