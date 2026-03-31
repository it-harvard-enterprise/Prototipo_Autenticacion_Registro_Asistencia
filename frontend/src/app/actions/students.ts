"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureApprovedAdmin } from "@/lib/auth/approved-admin";
import {
  biometricBackendConfigHint,
  resolveBiometricBackendBaseUrl,
} from "@/lib/biometric-backend";
import { Student } from "@/lib/types";

export interface StudentFormData {
  tipo_identificacion: string;
  numero_identificacion: string;
  no_matricula?: string | null;
  nombres: string;
  apellidos: string;
  grado: number;
  telefono?: string | null;
  direccion?: string | null;
  barrio?: string | null;
  nombre_acudiente?: string | null;
  telefono_acudiente?: string | null;
  programa?: string | null;
  fecha_inicio?: string | null;
  fecha_matricula?: string | null;
  valor_matricula?: number | null;
  matricula_cancelada?: boolean;
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

  const backendUrl = resolveBiometricBackendBaseUrl();
  if (!backendUrl) {
    return {
      success: false,
      error: `No se ha configurado la URL del backend biometrico. ${biometricBackendConfigHint()}`,
    };
  }

  const backendAccessKey = process.env.BIOMETRIC_BACKEND_ACCESS_KEY?.trim();
  const frontendOrigin =
    process.env.FRONTEND_ORIGIN?.split(",")[0]?.trim() ||
    "http://localhost:3000";

  try {
    const response = await fetch(`${backendUrl}/api/students/enroll`, {
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
      body: JSON.stringify(data),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    const rawText = await response.text();
    const payload = rawText
      ? (JSON.parse(rawText) as {
          success?: boolean;
          error?: string;
          data?: Student;
        })
      : {};

    if (!response.ok || payload.success === false) {
      return {
        success: false,
        error:
          payload.error ??
          `Error al crear el estudiante en backend (${response.status})`,
      };
    }

    return {
      success: true,
      data: payload.data,
    };
  } catch {
    return {
      success: false,
      error: `No fue posible conectar con el backend biometrico (${backendUrl})`,
    };
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

  const supabase = await createClient();

  const { data: student, error } = await supabase
    .from("estudiantes")
    .update({
      ...(data.tipo_identificacion !== undefined && {
        tipo_identificacion: data.tipo_identificacion,
      }),
      ...(data.numero_identificacion !== undefined && {
        numero_identificacion: data.numero_identificacion,
      }),
      ...(data.no_matricula !== undefined && {
        no_matricula: data.no_matricula,
      }),
      ...(data.nombres !== undefined && { nombres: data.nombres }),
      ...(data.apellidos !== undefined && { apellidos: data.apellidos }),
      ...(data.grado !== undefined && { grado: data.grado }),
      ...(data.telefono !== undefined && { telefono: data.telefono }),
      ...(data.direccion !== undefined && { direccion: data.direccion }),
      ...(data.barrio !== undefined && { barrio: data.barrio }),
      ...(data.nombre_acudiente !== undefined && {
        nombre_acudiente: data.nombre_acudiente,
      }),
      ...(data.telefono_acudiente !== undefined && {
        telefono_acudiente: data.telefono_acudiente,
      }),
      ...(data.programa !== undefined && { programa: data.programa }),
      ...(data.fecha_inicio !== undefined && {
        fecha_inicio: data.fecha_inicio,
      }),
      ...(data.fecha_matricula !== undefined && {
        fecha_matricula: data.fecha_matricula,
      }),
      ...(data.valor_matricula !== undefined && {
        valor_matricula: data.valor_matricula,
      }),
      ...(data.matricula_cancelada !== undefined && {
        matricula_cancelada: data.matricula_cancelada,
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
      updated_at: new Date().toISOString(),
    })
    .eq("numero_identificacion", numeroIdentificacion)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: student as Student };
}

export async function deleteStudent(
  numeroIdentificacion: string,
): Promise<{ success: boolean; error?: string }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("estudiantes")
    .delete()
    .eq("numero_identificacion", numeroIdentificacion);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
