"use server";

import { ensureApprovedAdmin } from "@/lib/auth/approved-admin";
import { callBackend } from "@/lib/backend/server-api";
import { toAppErrorMessage } from "@/lib/error-messages";
import { Student } from "@/lib/types";

function upper(value: string): string {
  return value.trim().toUpperCase();
}

function upperOrNull(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = value.trim();
  return normalized ? normalized.toUpperCase() : null;
}

function toErrorMessage(error: unknown): string {
  return toAppErrorMessage(error, "Error desconocido");
}

type BackendResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  exists?: boolean;
};

export interface StudentFormData {
  tipo_identificacion: string;
  numero_identificacion: string;
  no_matricula?: string | null;
  nombres: string;
  apellidos: string;
  email?: string | null;
  grado: string;
  telefono: string;
  direccion: string;
  barrio: string;
  nombre_acudiente: string;
  telefono_acudiente: string;
  eps: string;
  coordinador_academico: string;
  programa: string;
  fecha_inicio: string;
  fecha_matricula: string;
  valor_matricula: number;
  medio_pago_matricula:
    | "EFECTIVO"
    | "TRANSFERENCIA"
    | "NEQUI"
    | "DAVIPLATA"
    | "OTRO";
  valor_apoyo_semanal: number;
  huella_indice_derecho?: string | null;
  huella_indice_izquierdo?: string | null;
}

export async function createStudent(
  data: StudentFormData,
): Promise<{ success: boolean; error?: string; data?: Student }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<Student>>(
      "/api/students/create",
      {
        method: "POST",
        body: JSON.stringify({
          tipo_identificacion: upper(data.tipo_identificacion),
          numero_identificacion: upper(data.numero_identificacion),
          no_matricula: upperOrNull(data.no_matricula) ?? null,
          nombres: upper(data.nombres),
          apellidos: upper(data.apellidos),
          email: data.email?.trim() || null,
          grado: upper(data.grado),
          telefono: upper(data.telefono),
          direccion: upper(data.direccion),
          barrio: upper(data.barrio),
          nombre_acudiente: upper(data.nombre_acudiente),
          telefono_acudiente: upper(data.telefono_acudiente),
          eps: upper(data.eps),
          coordinador_academico: data.coordinador_academico.trim(),
          programa: upper(data.programa),
          fecha_inicio: data.fecha_inicio,
          fecha_matricula: data.fecha_matricula,
          valor_matricula: data.valor_matricula,
          medio_pago_matricula: upper(data.medio_pago_matricula),
          valor_apoyo_semanal: data.valor_apoyo_semanal,
          huella_indice_derecho: data.huella_indice_derecho || null,
          huella_indice_izquierdo: data.huella_indice_izquierdo || null,
        }),
      },
    );

    if (!payload.success) {
      return {
        success: false,
        error: payload.error || "Error desconocido",
      };
    }

    return { success: true, data: payload.data };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
}

export async function updateStudent(
  numeroIdentificacion: string,
  data: Partial<StudentFormData>,
): Promise<{ success: boolean; error?: string; data?: Student }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }
  try {
    const payload = await callBackend<BackendResponse<Student>>(
      "/api/students/update",
      {
        method: "POST",
        body: JSON.stringify({
          numero_identificacion: upper(numeroIdentificacion),
          data: {
            ...(data.tipo_identificacion !== undefined && {
              tipo_identificacion: upper(data.tipo_identificacion),
            }),
            ...(data.numero_identificacion !== undefined && {
              numero_identificacion: upper(data.numero_identificacion),
            }),
            ...(data.no_matricula !== undefined && {
              no_matricula: upperOrNull(data.no_matricula),
            }),
            ...(data.nombres !== undefined && { nombres: upper(data.nombres) }),
            ...(data.apellidos !== undefined && {
              apellidos: upper(data.apellidos),
            }),
            ...(data.email !== undefined && {
              email: data.email === null ? null : data.email.trim(),
            }),
            ...(data.grado !== undefined && { grado: upper(data.grado) }),
            ...(data.telefono !== undefined && {
              telefono: upper(data.telefono),
            }),
            ...(data.direccion !== undefined && {
              direccion: upper(data.direccion),
            }),
            ...(data.barrio !== undefined && { barrio: upper(data.barrio) }),
            ...(data.nombre_acudiente !== undefined && {
              nombre_acudiente: upper(data.nombre_acudiente),
            }),
            ...(data.telefono_acudiente !== undefined && {
              telefono_acudiente: upper(data.telefono_acudiente),
            }),
            ...(data.eps !== undefined && {
              eps: upper(data.eps),
            }),
            ...(data.coordinador_academico !== undefined && {
              coordinador_academico: data.coordinador_academico.trim(),
            }),
            ...(data.programa !== undefined && {
              programa: upper(data.programa),
            }),
            ...(data.fecha_inicio !== undefined && {
              fecha_inicio: data.fecha_inicio,
            }),
            ...(data.fecha_matricula !== undefined && {
              fecha_matricula: data.fecha_matricula,
            }),
            ...(data.valor_matricula !== undefined && {
              valor_matricula: data.valor_matricula,
            }),
            ...(data.medio_pago_matricula !== undefined && {
              medio_pago_matricula: upper(data.medio_pago_matricula),
            }),
            ...(data.valor_apoyo_semanal !== undefined && {
              valor_apoyo_semanal: data.valor_apoyo_semanal,
            }),
            ...(data.huella_indice_derecho !== undefined && {
              huella_indice_derecho: data.huella_indice_derecho,
            }),
            ...(data.huella_indice_izquierdo !== undefined && {
              huella_indice_izquierdo: data.huella_indice_izquierdo,
            }),
          },
        }),
      },
    );

    if (!payload.success) {
      return { success: false, error: payload.error || "Error desconocido" };
    }

    return { success: true, data: payload.data };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
}

export async function deleteStudent(
  numeroIdentificacion: string,
): Promise<{ success: boolean; error?: string }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }
  try {
    const payload = await callBackend<BackendResponse<null>>(
      "/api/students/delete",
      {
        method: "POST",
        body: JSON.stringify({
          numero_identificacion: upper(numeroIdentificacion),
        }),
      },
    );

    if (!payload.success) {
      return { success: false, error: payload.error || "Error desconocido" };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
}

export async function createStudentUserProfile(
  numeroIdentificacion: string,
): Promise<{
  success: boolean;
  error?: string;
  data?: Student;
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<Student>>(
      `/api/students/${encodeURIComponent(upper(numeroIdentificacion))}/profile`,
      {
        method: "POST",
      },
    );

    if (!payload.success) {
      return { success: false, error: payload.error || "Error desconocido" };
    }

    return { success: true, data: payload.data };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
}

export async function deleteStudentUserProfile(
  numeroIdentificacion: string,
): Promise<{
  success: boolean;
  error?: string;
  data?: Student;
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<Student>>(
      `/api/students/${encodeURIComponent(upper(numeroIdentificacion))}/profile`,
      {
        method: "DELETE",
      },
    );

    if (!payload.success) {
      return { success: false, error: payload.error || "Error desconocido" };
    }

    return { success: true, data: payload.data };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
}

export async function getStudents(): Promise<{
  success: boolean;
  error?: string;
  data?: Student[];
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<Student[]>>(
      "/api/students",
      {
        method: "GET",
      },
    );

    if (!payload.success) {
      return { success: false, error: payload.error || "Error desconocido" };
    }

    return { success: true, data: payload.data ?? [] };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
}

export async function getStudentById(
  numeroIdentificacion: string,
): Promise<{ success: boolean; error?: string; data?: Student }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<Student>>(
      `/api/students/${encodeURIComponent(upper(numeroIdentificacion))}`,
      {
        method: "GET",
      },
    );

    if (!payload.success || !payload.data) {
      return {
        success: false,
        error: payload.error || "No se encontró el estudiante",
      };
    }

    return { success: true, data: payload.data };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
}

export async function studentExists(numeroIdentificacion: string): Promise<{
  success: boolean;
  error?: string;
  exists?: boolean;
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<null>>(
      "/api/students/exists",
      {
        method: "POST",
        body: JSON.stringify({
          numero_identificacion: upper(numeroIdentificacion),
        }),
      },
    );

    if (!payload.success) {
      return { success: false, error: payload.error || "Error desconocido" };
    }

    return { success: true, exists: Boolean(payload.exists) };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
}
