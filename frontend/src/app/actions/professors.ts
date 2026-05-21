"use server";

import { ensureApprovedAdmin } from "@/lib/auth/approved-admin";
import { callBackend } from "@/lib/backend/server-api";
import { toAppErrorMessage } from "@/lib/error-messages";
import { Professor } from "@/lib/types";

function upper(value: string): string {
  return value.trim().toUpperCase();
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

export interface ProfessorFormData {
  tipo_identificacion: string;
  numero_identificacion: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  direccion: string;
  barrio: string;
  nombre_contacto_emergencia: string;
  telefono_contacto_emergencia: string;
  eps: string;
  email: string;
}

export async function createProfessor(
  data: ProfessorFormData,
): Promise<{ success: boolean; error?: string; data?: Professor }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<Professor>>(
      "/api/professors/create",
      {
        method: "POST",
        body: JSON.stringify({
          tipo_identificacion: upper(data.tipo_identificacion),
          numero_identificacion: upper(data.numero_identificacion),
          nombres: upper(data.nombres),
          apellidos: upper(data.apellidos),
          telefono: upper(data.telefono),
          direccion: upper(data.direccion),
          barrio: upper(data.barrio),
          nombre_contacto_emergencia: upper(data.nombre_contacto_emergencia),
          telefono_contacto_emergencia: upper(
            data.telefono_contacto_emergencia,
          ),
          eps: upper(data.eps),
          email: data.email.trim().toLowerCase(),
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

export async function updateProfessor(
  numeroIdentificacion: string,
  data: Partial<ProfessorFormData>,
): Promise<{ success: boolean; error?: string; data?: Professor }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }
  try {
    const payload = await callBackend<BackendResponse<Professor>>(
      "/api/professors/update",
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
            ...(data.nombres !== undefined && { nombres: upper(data.nombres) }),
            ...(data.apellidos !== undefined && {
              apellidos: upper(data.apellidos),
            }),
            ...(data.telefono !== undefined && {
              telefono: upper(data.telefono),
            }),
            ...(data.direccion !== undefined && {
              direccion: upper(data.direccion),
            }),
            ...(data.barrio !== undefined && { barrio: upper(data.barrio) }),
            ...(data.nombre_contacto_emergencia !== undefined && {
              nombre_contacto_emergencia: upper(
                data.nombre_contacto_emergencia,
              ),
            }),
            ...(data.telefono_contacto_emergencia !== undefined && {
              telefono_contacto_emergencia: upper(
                data.telefono_contacto_emergencia,
              ),
            }),
            ...(data.eps !== undefined && { eps: upper(data.eps) }),
            ...(data.email !== undefined && { email: data.email.trim() }),
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

export async function deleteProfessor(
  numeroIdentificacion: string,
): Promise<{ success: boolean; error?: string }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }
  try {
    const payload = await callBackend<BackendResponse<null>>(
      "/api/professors/delete",
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

export async function createProfessorUserProfile(
  numeroIdentificacion: string,
): Promise<{
  success: boolean;
  error?: string;
  data?: Professor;
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<Professor>>(
      `/api/professors/${encodeURIComponent(upper(numeroIdentificacion))}/profile`,
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

export async function deleteProfessorUserProfile(
  numeroIdentificacion: string,
): Promise<{
  success: boolean;
  error?: string;
  data?: Professor;
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<Professor>>(
      `/api/professors/${encodeURIComponent(upper(numeroIdentificacion))}/profile`,
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

export async function getProfessors(): Promise<{
  success: boolean;
  error?: string;
  data?: Professor[];
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<Professor[]>>(
      "/api/professors",
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

export async function getProfessorById(
  numeroIdentificacion: string,
): Promise<{ success: boolean; error?: string; data?: Professor }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<Professor>>(
      `/api/professors/${encodeURIComponent(upper(numeroIdentificacion))}`,
      {
        method: "GET",
      },
    );

    if (!payload.success || !payload.data) {
      return {
        success: false,
        error: payload.error || "No se encontró el profesor",
      };
    }

    return { success: true, data: payload.data };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
}

export async function professorExists(
  numeroIdentificacion: string,
): Promise<{ success: boolean; error?: string; exists?: boolean }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<null>>(
      "/api/professors/exists",
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
