"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureApprovedAdmin } from "@/lib/auth/approved-admin";
import { resolveBiometricBackendBaseUrl } from "@/lib/biometric-backend";
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
    const backendUrl = resolveBiometricBackendBaseUrl();
    if (!backendUrl) {
      return {
        success: false,
        error:
          "Backend URL no configurado. Configure BIOMETRIC_BACKEND_URL o BIOMETRIC_BACKEND_INTERNAL_URL.",
      };
    }

    const frontendOrigin =
      process.env.FRONTEND_ORIGIN?.split(",")[0]?.trim() ||
      "http://localhost:3000";
    const normalizedNumeroIdentificacion = upper(data.numero_identificacion);

    const response = await fetch(`${backendUrl}/api/students/enroll`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Frontend-Origin": frontendOrigin,
      },
      body: JSON.stringify({
        tipo_identificacion: upper(data.tipo_identificacion),
        numero_identificacion: normalizedNumeroIdentificacion,
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
        coordinador_academico: upper(data.coordinador_academico),
        programa: upper(data.programa),
        fecha_inicio: data.fecha_inicio,
        fecha_matricula: data.fecha_matricula,
        valor_matricula: data.valor_matricula,
        medio_pago_matricula: upper(data.medio_pago_matricula),
        valor_apoyo_semanal: data.valor_apoyo_semanal,
        huella_indice_derecho: data.huella_indice_derecho || null,
        huella_indice_izquierdo: data.huella_indice_izquierdo || null,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return {
        success: false,
        error: errorData?.error || `Error del servidor: ${response.status}`,
      };
    }

    const responseData = await response.json().catch(() => null);
    if (!responseData || !responseData.success) {
      return {
        success: false,
        error: responseData?.error || "Error desconocido",
      };
    }

    // Fetch the created student from Supabase to return the full Student object
    const supabase = await createClient();
    const { data: student, error } = await supabase
      .from("estudiantes")
      .select("*")
      .eq("numero_identificacion", normalizedNumeroIdentificacion)
      .single();

    if (error || !student) {
      return {
        success: true,
        data: responseData.data,
      };
    }

    return { success: true, data: student as Student };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error desconocido",
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
        tipo_identificacion: upper(data.tipo_identificacion),
      }),
      ...(data.numero_identificacion !== undefined && {
        numero_identificacion: upper(data.numero_identificacion),
      }),
      ...(data.no_matricula !== undefined && {
        no_matricula: upperOrNull(data.no_matricula),
      }),
      ...(data.nombres !== undefined && { nombres: upper(data.nombres) }),
      ...(data.apellidos !== undefined && { apellidos: upper(data.apellidos) }),
      ...(data.email !== undefined && {
        email: data.email === null ? null : data.email.trim(),
      }),
      ...(data.grado !== undefined && { grado: upper(data.grado) }),
      ...(data.telefono !== undefined && { telefono: upper(data.telefono) }),
      ...(data.direccion !== undefined && { direccion: upper(data.direccion) }),
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
        coordinador_academico: upper(data.coordinador_academico),
      }),
      ...(data.programa !== undefined && { programa: upper(data.programa) }),
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
      updated_at: new Date().toISOString(),
    })
    .eq("numero_identificacion", upper(numeroIdentificacion))
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
