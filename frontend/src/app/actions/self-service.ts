"use server";

import {
  resolveCurrentUserAccess,
  type ResolvedRole,
} from "@/lib/auth/resolved-access";
import { callBackend } from "@/lib/backend/server-api";
import { Professor, Student } from "@/lib/types";

type BackendResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type PersonCourseInfo = {
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
  cursos: PersonCourseInfo[];
};

type PersonLookupPayload = {
  found: boolean;
  numero_identificacion: string;
  records: PersonRecord[];
};

type AttendanceSummaryPayload = {
  attended_count?: number;
  absent_count?: number;
  total_count?: number;
};

export interface CurrentAttendanceSummary {
  attendedCount: number;
  absentCount: number;
  totalCount: number;
}

export interface CurrentUserCoursesOverview {
  role: "estudiante" | "profesor";
  numeroIdentificacion: string;
  fullName: string;
  courses: PersonCourseInfo[];
}

export interface CurrentUserProfileOverview extends CurrentUserCoursesOverview {
  student?: Student;
  professor?: Professor;
  attendance: CurrentAttendanceSummary;
}

export interface CurrentStudentPaymentsOverview {
  role: "estudiante";
  fullName: string;
  numeroIdentificacion: string;
  student: Student;
  attendance: CurrentAttendanceSummary;
  deudaValorTotal: number;
}

function normalizeNumeroFromMetadata(
  metadata?: Record<string, unknown>,
): string {
  if (!metadata) {
    return "";
  }

  const candidates = [
    metadata.numero_identificacion,
    metadata.numeroIdentificacion,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim().toUpperCase();
    }
  }

  return "";
}

function asCount(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.trunc(parsed);
}

function asAmount(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Error desconocido";
}

function getRecordRole(
  role: "estudiante" | "profesor",
): "ESTUDIANTE" | "PROFESOR" {
  return role === "estudiante" ? "ESTUDIANTE" : "PROFESOR";
}

function resolveDisplayName(
  record: PersonRecord,
  fallback?: string,
  email?: string,
): string {
  const name = `${record.nombres} ${record.apellidos}`.trim();
  return name || fallback || email || "Usuario";
}

async function resolveSelfContext(allowedRoles: ResolvedRole[]): Promise<{
  ok: boolean;
  error?: string;
  role?: "estudiante" | "profesor";
  numeroIdentificacion?: string;
  fallbackName?: string;
  email?: string;
}> {
  const access = await resolveCurrentUserAccess();

  if (!access.user) {
    return { ok: false, error: "Debe iniciar sesión para continuar." };
  }

  if (!access.role || !allowedRoles.includes(access.role)) {
    return { ok: false, error: "No tiene permisos para esta funcionalidad." };
  }

  if (!access.approved) {
    return {
      ok: false,
      error: "Su usuario no está aprobado para acceder a esta funcionalidad.",
    };
  }

  if (access.role !== "estudiante" && access.role !== "profesor") {
    return { ok: false, error: "Esta funcionalidad no aplica a su rol." };
  }

  const numeroIdentificacion = normalizeNumeroFromMetadata(
    access.user.user_metadata,
  );

  if (!numeroIdentificacion) {
    return {
      ok: false,
      error:
        "No fue posible resolver su número de identificación desde su cuenta.",
    };
  }

  return {
    ok: true,
    role: access.role,
    numeroIdentificacion,
    fallbackName: access.fullName,
    email: access.user.email,
  };
}

async function getPersonLookup(
  numeroIdentificacion: string,
): Promise<PersonLookupPayload> {
  const payload = await callBackend<BackendResponse<PersonLookupPayload>>(
    `/api/person/by-id/${encodeURIComponent(numeroIdentificacion)}`,
    {
      method: "GET",
    },
  );

  if (!payload.success || !payload.data) {
    throw new Error(payload.error ?? "No fue posible cargar su información.");
  }

  return payload.data;
}

async function getStudentByNumero(
  numeroIdentificacion: string,
): Promise<Student> {
  const payload = await callBackend<BackendResponse<Student>>(
    `/api/students/${encodeURIComponent(numeroIdentificacion)}`,
    {
      method: "GET",
    },
  );

  if (!payload.success || !payload.data) {
    throw new Error(payload.error ?? "No fue posible cargar su perfil.");
  }

  return payload.data;
}

async function getProfessorByNumero(
  numeroIdentificacion: string,
): Promise<Professor> {
  const payload = await callBackend<BackendResponse<Professor>>(
    `/api/professors/${encodeURIComponent(numeroIdentificacion)}`,
    {
      method: "GET",
    },
  );

  if (!payload.success || !payload.data) {
    throw new Error(payload.error ?? "No fue posible cargar su perfil.");
  }

  return payload.data;
}

async function getStudentAttendanceSummary(
  numeroIdentificacion: string,
): Promise<CurrentAttendanceSummary> {
  const payload = await callBackend<BackendResponse<AttendanceSummaryPayload>>(
    `/api/students/${encodeURIComponent(numeroIdentificacion)}/attendance-summary`,
    {
      method: "GET",
    },
  );

  if (!payload.success) {
    return {
      attendedCount: 0,
      absentCount: 0,
      totalCount: 0,
    };
  }

  return {
    attendedCount: asCount(payload.data?.attended_count),
    absentCount: asCount(payload.data?.absent_count),
    totalCount: asCount(payload.data?.total_count),
  };
}

export async function getCurrentUserCoursesOverview(): Promise<{
  success: boolean;
  error?: string;
  data?: CurrentUserCoursesOverview;
}> {
  const context = await resolveSelfContext(["estudiante", "profesor"]);
  if (!context.ok || !context.role || !context.numeroIdentificacion) {
    return { success: false, error: context.error };
  }
  const role = context.role;

  try {
    const person = await getPersonLookup(context.numeroIdentificacion);
    const roleRecord = person.records.find(
      (record) => record.role === getRecordRole(role),
    );

    if (!roleRecord) {
      return {
        success: false,
        error: "No se encontró su perfil asociado a este rol.",
      };
    }

    return {
      success: true,
      data: {
        role,
        numeroIdentificacion: context.numeroIdentificacion,
        fullName: resolveDisplayName(
          roleRecord,
          context.fallbackName,
          context.email,
        ),
        courses: roleRecord.cursos ?? [],
      },
    };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function getCurrentUserProfileOverview(): Promise<{
  success: boolean;
  error?: string;
  data?: CurrentUserProfileOverview;
}> {
  const coursesOverview = await getCurrentUserCoursesOverview();
  if (!coursesOverview.success || !coursesOverview.data) {
    return { success: false, error: coursesOverview.error };
  }

  const base = coursesOverview.data;

  try {
    if (base.role === "estudiante") {
      const [student, attendance] = await Promise.all([
        getStudentByNumero(base.numeroIdentificacion),
        getStudentAttendanceSummary(base.numeroIdentificacion),
      ]);

      return {
        success: true,
        data: {
          ...base,
          student,
          attendance,
        },
      };
    }

    const professor = await getProfessorByNumero(base.numeroIdentificacion);

    return {
      success: true,
      data: {
        ...base,
        professor,
        attendance: {
          attendedCount: 0,
          absentCount: 0,
          totalCount: 0,
        },
      },
    };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function getCurrentStudentPaymentsOverview(): Promise<{
  success: boolean;
  error?: string;
  data?: CurrentStudentPaymentsOverview;
}> {
  const profile = await getCurrentUserProfileOverview();
  if (!profile.success || !profile.data) {
    return { success: false, error: profile.error };
  }

  if (profile.data.role !== "estudiante" || !profile.data.student) {
    return {
      success: false,
      error: "Esta funcionalidad solo está disponible para estudiantes.",
    };
  }

  const clasesAdeudadas = asCount(profile.data.student.clases_adeudadas);
  const valorApoyoSemanal = asAmount(profile.data.student.valor_apoyo_semanal);

  return {
    success: true,
    data: {
      role: "estudiante",
      fullName: profile.data.fullName,
      numeroIdentificacion: profile.data.numeroIdentificacion,
      student: profile.data.student,
      attendance: profile.data.attendance,
      deudaValorTotal: clasesAdeudadas * valorApoyoSemanal,
    },
  };
}
