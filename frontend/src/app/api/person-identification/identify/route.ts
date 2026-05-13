import { NextRequest, NextResponse } from "next/server";

import { ensureApprovedAdmin } from "@/lib/auth/approved-admin";
import { callBackend } from "@/lib/backend/server-api";

type IdentifyMode = "id" | "fingerprint";

type IdentifyRequestBody = {
  mode?: IdentifyMode;
  numeroIdentificacion?: string;
  fingerprintTemplate?: string;
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

type PersonLookupPayload = {
  found: boolean;
  numero_identificacion: string;
  records: PersonRecord[];
};

type BackendEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type BackendFingerprintResponse = {
  success: boolean;
  numero_identificacion?: string;
  confidence?: number;
  error?: string;
};

function normalizeId(value: string | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

async function lookupPersonById(
  numeroIdentificacion: string,
): Promise<PersonLookupPayload> {
  const payload = await callBackend<BackendEnvelope<PersonLookupPayload>>(
    `/api/person/by-id/${encodeURIComponent(numeroIdentificacion)}`,
    {
      method: "GET",
    },
  );

  if (!payload.success || !payload.data) {
    throw new Error(payload.error ?? "No fue posible consultar la persona");
  }

  return payload.data;
}

async function identifyByFingerprint(fingerprintTemplate: string): Promise<{
  success: boolean;
  found: boolean;
  confidence?: number;
  numero_identificacion?: string;
  error?: string;
}> {
  try {
    const payload = await callBackend<BackendFingerprintResponse>(
      "/api/person/identify-by-fingerprint",
      {
        method: "POST",
        body: JSON.stringify({
          fingerprint_template: fingerprintTemplate,
        }),
      },
    );

    if (!payload.success) {
      return {
        success: false,
        found: false,
        error: payload.error ?? "No fue posible validar la huella",
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
  } catch (error) {
    return {
      success: false,
      found: false,
      error:
        error instanceof Error
          ? error.message
          : "No fue posible validar la huella",
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

    const identifyResult = await identifyByFingerprint(fingerprintTemplate);
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
