"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureApprovedAdmin } from "@/lib/auth/approved-admin";
import { Student } from "@/lib/types";

export interface StudentFormData {
  tipo_identificacion: string;
  numero_identificacion: string;
  no_matricula?: string | null;
  nombres: string;
  apellidos: string;
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
    | "efectivo"
    | "transferencia"
    | "nequi"
    | "daviplata"
    | "otro";
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

  const supabase = await createClient();

  const randomFingerprintToken = crypto.randomUUID();
  const huellaIndiceDerecho =
    data.huella_indice_derecho?.trim() ||
    `PENDING_FINGERPRINT_RIGHT_${randomFingerprintToken}`;
  const huellaIndiceIzquierdo =
    data.huella_indice_izquierdo?.trim() ||
    `PENDING_FINGERPRINT_LEFT_${randomFingerprintToken}`;

  const { data: student, error } = await supabase
    .from("estudiantes")
    .insert({
      tipo_identificacion: data.tipo_identificacion,
      numero_identificacion: data.numero_identificacion,
      no_matricula: data.no_matricula ?? null,
      nombres: data.nombres,
      apellidos: data.apellidos,
      grado: data.grado,
      telefono: data.telefono,
      direccion: data.direccion,
      barrio: data.barrio,
      nombre_acudiente: data.nombre_acudiente,
      telefono_acudiente: data.telefono_acudiente,
      eps: data.eps,
      coordinador_academico: data.coordinador_academico,
      programa: data.programa,
      fecha_inicio: data.fecha_inicio,
      fecha_matricula: data.fecha_matricula,
      valor_matricula: data.valor_matricula,
      medio_pago_matricula: data.medio_pago_matricula,
      valor_apoyo_semanal: data.valor_apoyo_semanal,
      huella_indice_derecho: huellaIndiceDerecho,
      huella_indice_izquierdo: huellaIndiceIzquierdo,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: student as Student };
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
      ...(data.eps !== undefined && {
        eps: data.eps,
      }),
      ...(data.coordinador_academico !== undefined && {
        coordinador_academico: data.coordinador_academico,
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
      ...(data.medio_pago_matricula !== undefined && {
        medio_pago_matricula: data.medio_pago_matricula,
      }),
      ...(data.valor_apoyo_semanal !== undefined && {
        valor_apoyo_semanal: data.valor_apoyo_semanal,
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
