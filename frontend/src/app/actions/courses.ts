"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureApprovedAdmin } from "@/lib/auth/approved-admin";
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
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

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
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

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
      ...(data.salon !== undefined && { salon: data.salon ?? null }),
      ...(data.fecha_inicio !== undefined && {
        fecha_inicio: data.fecha_inicio,
      }),
      ...(data.fecha_fin !== undefined && { fecha_fin: data.fecha_fin }),
      updated_at: new Date().toISOString(),
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
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

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

export async function getCourseById(
  idCurso: number,
): Promise<{ success: boolean; error?: string; data?: Course }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const supabase = await createClient();

  const { data: course, error } = await supabase
    .from("cursos")
    .select("*")
    .eq("id_curso", idCurso)
    .single();

  if (error) {
    return { success: false, error: "No se encontró el curso" };
  }

  return { success: true, data: course as Course };
}

export async function associateStudentsToCourse(
  idCurso: number,
  studentIds: string[],
): Promise<{ success: boolean; error?: string; insertedCount?: number }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const supabase = await createClient();

  const normalizedIds = Array.from(
    new Set(studentIds.map((id) => id.trim()).filter(Boolean)),
  );

  if (normalizedIds.length === 0) {
    return {
      success: false,
      error: "Debe ingresar al menos un numero_identificacion",
    };
  }

  const { data: courseExists, error: courseError } = await supabase
    .from("cursos")
    .select("id_curso")
    .eq("id_curso", idCurso)
    .single();

  if (courseError || !courseExists) {
    return { success: false, error: "El id_curso no existe" };
  }

  const { data: students, error: studentsError } = await supabase
    .from("estudiantes")
    .select("numero_identificacion")
    .in("numero_identificacion", normalizedIds);

  if (studentsError) {
    return { success: false, error: studentsError.message };
  }

  const foundIds = new Set(
    (students ?? []).map((s) => s.numero_identificacion),
  );
  const missingIds = normalizedIds.filter((id) => !foundIds.has(id));

  if (missingIds.length > 0) {
    return {
      success: false,
      error: `No existen estos estudiantes: ${missingIds.join(", ")}`,
    };
  }

  const payload = normalizedIds.map((numero_identificacion) => ({
    numero_identificacion,
    id_curso: idCurso,
  }));

  const { error: insertError } = await supabase
    .from("cursos_x_estudiantes")
    .insert(payload);

  if (insertError) {
    if (insertError.message.toLowerCase().includes("duplicate")) {
      return {
        success: false,
        error:
          "Una o más asociaciones ya existen. Verifique los estudiantes seleccionados.",
      };
    }
    return { success: false, error: insertError.message };
  }

  return { success: true, insertedCount: payload.length };
}

export async function dissociateStudentsFromCourse(
  idCurso: number,
  studentIds: string[],
): Promise<{ success: boolean; error?: string; removedCount?: number }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const supabase = await createClient();

  const normalizedIds = Array.from(
    new Set(studentIds.map((id) => id.trim()).filter(Boolean)),
  );

  if (normalizedIds.length === 0) {
    return {
      success: false,
      error: "Debe ingresar al menos un numero_identificacion",
    };
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("cursos_x_estudiantes")
    .select("numero_identificacion")
    .eq("id_curso", idCurso)
    .in("numero_identificacion", normalizedIds);

  if (existingError) {
    return { success: false, error: existingError.message };
  }

  const existingSet = new Set(
    (existingRows ?? []).map((row) => row.numero_identificacion),
  );
  const missingIds = normalizedIds.filter((id) => !existingSet.has(id));

  if (missingIds.length > 0) {
    return {
      success: false,
      error:
        "No existe vinculo para estos estudiantes en el curso: " +
        missingIds.join(", "),
    };
  }

  const { error: deleteError } = await supabase
    .from("cursos_x_estudiantes")
    .delete()
    .eq("id_curso", idCurso)
    .in("numero_identificacion", normalizedIds);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  return { success: true, removedCount: normalizedIds.length };
}

type LinkedStudentRow = {
  numero_identificacion: string;
  nombres: string;
  apellidos: string;
  no_matricula: string | null;
  grado: string;
  tipo_identificacion: string | null;
};

export async function getStudentsByCourseId(
  idCurso: number,
): Promise<{ success: boolean; error?: string; data?: LinkedStudentRow[] }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cursos_x_estudiantes")
    .select(
      "numero_identificacion, estudiantes (numero_identificacion, nombres, apellidos, no_matricula, grado, tipo_identificacion)",
    )
    .eq("id_curso", idCurso);

  if (error) {
    return { success: false, error: error.message };
  }

  const normalizedData = (
    (data ?? []) as Array<{
      estudiantes: LinkedStudentRow | LinkedStudentRow[] | null;
    }>
  )
    .map((row) => {
      if (Array.isArray(row.estudiantes)) {
        return row.estudiantes[0] ?? null;
      }
      return row.estudiantes;
    })
    .filter((student): student is LinkedStudentRow => Boolean(student))
    .sort((a, b) => a.apellidos.localeCompare(b.apellidos));

  return { success: true, data: normalizedData };
}
