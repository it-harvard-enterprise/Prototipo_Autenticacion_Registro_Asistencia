"use server";

import { createClient } from "@/lib/supabase/server";
import { Course } from "@/lib/types";

export interface CourseFormData {
  nombre_curso: string;
  nivel_curso: string;
  hora_inicio: string;
  hora_fin: string;
  salon?: string | null;
  fecha_inicio: string;
  fecha_fin: string;
}

export async function createCourse(
  data: CourseFormData,
): Promise<{ success: boolean; error?: string; data?: Course }> {
  const supabase = await createClient();

  const { data: course, error } = await supabase
    .from("cursos")
    .insert({
      nombre_curso: data.nombre_curso,
      nivel_curso: data.nivel_curso,
      hora_inicio: data.hora_inicio,
      hora_fin: data.hora_fin,
      salon: data.salon ?? null,
      fecha_inicio: data.fecha_inicio,
      fecha_fin: data.fecha_fin,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: course as Course };
}

export async function updateCourse(
  idCurso: number,
  data: Partial<CourseFormData>,
): Promise<{ success: boolean; error?: string; data?: Course }> {
  const supabase = await createClient();

  const { data: course, error } = await supabase
    .from("cursos")
    .update({
      ...(data.nombre_curso !== undefined && {
        nombre_curso: data.nombre_curso,
      }),
      ...(data.nivel_curso !== undefined && { nivel_curso: data.nivel_curso }),
      ...(data.hora_inicio !== undefined && { hora_inicio: data.hora_inicio }),
      ...(data.hora_fin !== undefined && { hora_fin: data.hora_fin }),
      ...(data.salon !== undefined && { salon: data.salon }),
      ...(data.fecha_inicio !== undefined && {
        fecha_inicio: data.fecha_inicio,
      }),
      ...(data.fecha_fin !== undefined && { fecha_fin: data.fecha_fin }),
    })
    .eq("id_curso", idCurso)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: course as Course };
}

export async function deleteCourse(
  idCurso: number,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cursos")
    .delete()
    .eq("id_curso", idCurso);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
