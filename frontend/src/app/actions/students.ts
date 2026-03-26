"use server";

import { createClient } from "@/lib/supabase/server";
import { Student } from "@/lib/types";

export interface StudentFormData {
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
  firma?: string | null;
}

export async function createStudent(
  data: StudentFormData,
): Promise<{ success: boolean; error?: string; data?: Student }> {
  const supabase = await createClient();

  const { data: student, error } = await supabase
    .from("estudiantes")
    .insert({
      numero_identificacion: data.numero_identificacion,
      no_matricula: data.no_matricula ?? null,
      nombres: data.nombres,
      apellidos: data.apellidos,
      grado: data.grado,
      telefono: data.telefono ?? null,
      direccion: data.direccion ?? null,
      barrio: data.barrio ?? null,
      nombre_acudiente: data.nombre_acudiente ?? null,
      telefono_acudiente: data.telefono_acudiente ?? null,
      programa: data.programa ?? null,
      fecha_inicio: data.fecha_inicio ?? null,
      fecha_matricula: data.fecha_matricula ?? null,
      valor_matricula: data.valor_matricula ?? null,
      matricula_cancelada: data.matricula_cancelada ?? false,
      valor_apoyo_semanal: data.valor_apoyo_semanal,
      huella_indice_derecho: data.huella_indice_derecho ?? null,
      huella_indice_izquierdo: data.huella_indice_izquierdo ?? null,
      firma: data.firma ?? null,
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
  const supabase = await createClient();

  const { data: student, error } = await supabase
    .from("estudiantes")
    .update({
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
      ...(data.firma !== undefined && {
        firma: data.firma,
      }),
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
