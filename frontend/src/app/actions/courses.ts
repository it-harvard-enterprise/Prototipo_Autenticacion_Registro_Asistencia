"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureApprovedAdmin } from "@/lib/auth/approved-admin";
import { Course } from "@/lib/types";

function upper(value: string): string {
  return value.trim().toUpperCase();
}

function upperOrNull(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = value.trim();
  return normalized ? normalized.toUpperCase() : null;
}

function normalizeIdentificationIds(ids: string[]): string[] {
  return Array.from(
    new Set(
      ids.map((id) => id.trim().toUpperCase()).filter((id) => id.length > 0),
    ),
  );
}

async function ensureCourseExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  idCurso: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: courseExists, error: courseError } = await supabase
    .from("cursos")
    .select("id_curso")
    .eq("id_curso", idCurso)
    .single();

  if (courseError || !courseExists) {
    return { ok: false, error: "El id_curso no existe" };
  }

  return { ok: true };
}

export type ParticipantRole =
  | "ESTUDIANTE"
  | "PROFESOR"
  | "ESTUDIANTE_Y_PROFESOR"
  | "NO_ENCONTRADO";

export interface ParticipantLookupResult {
  numero_identificacion: string;
  role: ParticipantRole;
}

export interface LinkedParticipantRow {
  numero_identificacion: string;
  role: "ESTUDIANTE" | "PROFESOR";
  tipo_identificacion: string | null;
  no_matricula: string | null;
  grado: string | null;
  email: string | null;
  nombres: string;
  apellidos: string;
}

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
      nombre_curso: upper(data.nombre_curso),
      nivel_curso: upper(data.nivel_curso),
      hora_inicio: data.hora_inicio,
      hora_fin: data.hora_fin,
      salon: upperOrNull(data.salon) ?? null,
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
        nombre_curso: upper(data.nombre_curso),
      }),
      ...(data.nivel_curso !== undefined && {
        nivel_curso: upper(data.nivel_curso),
      }),
      ...(data.hora_inicio !== undefined && { hora_inicio: data.hora_inicio }),
      ...(data.hora_fin !== undefined && { hora_fin: data.hora_fin }),
      ...(data.salon !== undefined && { salon: upperOrNull(data.salon) }),
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

export async function lookupParticipantsByIdentification(
  participantIds: string[],
): Promise<{
  success: boolean;
  error?: string;
  data?: ParticipantLookupResult[];
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const supabase = await createClient();
  const normalizedIds = normalizeIdentificationIds(participantIds);

  if (normalizedIds.length === 0) {
    return { success: true, data: [] };
  }

  const [
    { data: students, error: studentsError },
    { data: professors, error: professorsError },
  ] = await Promise.all([
    supabase
      .from("estudiantes")
      .select("numero_identificacion")
      .in("numero_identificacion", normalizedIds),
    supabase
      .from("profesores")
      .select("numero_identificacion")
      .in("numero_identificacion", normalizedIds),
  ]);

  if (studentsError) {
    return { success: false, error: studentsError.message };
  }

  if (professorsError) {
    return { success: false, error: professorsError.message };
  }

  const studentIds = new Set(
    (students ?? []).map((row) => row.numero_identificacion),
  );
  const professorIds = new Set(
    (professors ?? []).map((row) => row.numero_identificacion),
  );

  const data = normalizedIds.map((numero_identificacion) => {
    const isStudent = studentIds.has(numero_identificacion);
    const isProfessor = professorIds.has(numero_identificacion);

    let role: ParticipantRole = "NO_ENCONTRADO";
    if (isStudent && isProfessor) role = "ESTUDIANTE_Y_PROFESOR";
    else if (isStudent) role = "ESTUDIANTE";
    else if (isProfessor) role = "PROFESOR";

    return {
      numero_identificacion,
      role,
    };
  });

  return { success: true, data };
}

export async function associateParticipantsToCourse(
  idCurso: number,
  participantIds: string[],
): Promise<{
  success: boolean;
  error?: string;
  insertedCount?: number;
  insertedStudentsCount?: number;
  insertedProfessorsCount?: number;
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const supabase = await createClient();
  const normalizedIds = normalizeIdentificationIds(participantIds);

  if (normalizedIds.length === 0) {
    return {
      success: false,
      error: "Debe ingresar al menos un numero_identificacion",
    };
  }

  const courseCheck = await ensureCourseExists(supabase, idCurso);
  if (!courseCheck.ok) {
    return { success: false, error: courseCheck.error };
  }

  const [
    { data: students, error: studentsError },
    { data: professors, error: professorsError },
  ] = await Promise.all([
    supabase
      .from("estudiantes")
      .select("numero_identificacion")
      .in("numero_identificacion", normalizedIds),
    supabase
      .from("profesores")
      .select("numero_identificacion")
      .in("numero_identificacion", normalizedIds),
  ]);

  if (studentsError) {
    return { success: false, error: studentsError.message };
  }

  if (professorsError) {
    return { success: false, error: professorsError.message };
  }

  const studentIds = new Set(
    (students ?? []).map((row) => row.numero_identificacion),
  );
  const professorIds = new Set(
    (professors ?? []).map((row) => row.numero_identificacion),
  );

  const missingIds = normalizedIds.filter(
    (id) => !studentIds.has(id) && !professorIds.has(id),
  );

  if (missingIds.length > 0) {
    return {
      success: false,
      error:
        "No existen estos participantes (ni estudiantes ni profesores): " +
        missingIds.join(", "),
    };
  }

  const studentIdList = normalizedIds.filter((id) => studentIds.has(id));
  const professorIdList = normalizedIds.filter((id) => professorIds.has(id));

  const [
    { data: linkedStudents, error: linkedStudentsError },
    { data: linkedProfessors, error: linkedProfessorsError },
  ] = await Promise.all([
    studentIdList.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("cursos_x_estudiantes")
          .select("numero_identificacion")
          .eq("id_curso", idCurso)
          .in("numero_identificacion", studentIdList),
    professorIdList.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("cursos_x_profesores")
          .select("numero_identificacion")
          .eq("id_curso", idCurso)
          .in("numero_identificacion", professorIdList),
  ]);

  if (linkedStudentsError) {
    return { success: false, error: linkedStudentsError.message };
  }

  if (linkedProfessorsError) {
    return { success: false, error: linkedProfessorsError.message };
  }

  const alreadyLinkedStudents = new Set(
    (linkedStudents ?? []).map((row) => row.numero_identificacion),
  );
  const alreadyLinkedProfessors = new Set(
    (linkedProfessors ?? []).map((row) => row.numero_identificacion),
  );

  const studentsToInsert = studentIdList.filter(
    (id) => !alreadyLinkedStudents.has(id),
  );
  const professorsToInsert = professorIdList.filter(
    (id) => !alreadyLinkedProfessors.has(id),
  );

  if (studentsToInsert.length > 0) {
    const payload = studentsToInsert.map((numero_identificacion) => ({
      numero_identificacion,
      id_curso: idCurso,
    }));
    const { error } = await supabase
      .from("cursos_x_estudiantes")
      .insert(payload);
    if (error) {
      return { success: false, error: error.message };
    }
  }

  if (professorsToInsert.length > 0) {
    const payload = professorsToInsert.map((numero_identificacion) => ({
      numero_identificacion,
      id_curso: idCurso,
    }));
    const { error } = await supabase
      .from("cursos_x_profesores")
      .insert(payload);
    if (error) {
      return { success: false, error: error.message };
    }
  }

  return {
    success: true,
    insertedStudentsCount: studentsToInsert.length,
    insertedProfessorsCount: professorsToInsert.length,
    insertedCount: studentsToInsert.length + professorsToInsert.length,
  };
}

export async function dissociateParticipantsFromCourse(
  idCurso: number,
  participantIds: string[],
): Promise<{
  success: boolean;
  error?: string;
  removedCount?: number;
  removedStudentsCount?: number;
  removedProfessorsCount?: number;
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const supabase = await createClient();
  const normalizedIds = normalizeIdentificationIds(participantIds);

  if (normalizedIds.length === 0) {
    return {
      success: false,
      error: "Debe ingresar al menos un numero_identificacion",
    };
  }

  const [
    { data: linkedStudents, error: linkedStudentsError },
    { data: linkedProfessors, error: linkedProfessorsError },
  ] = await Promise.all([
    supabase
      .from("cursos_x_estudiantes")
      .select("numero_identificacion")
      .eq("id_curso", idCurso)
      .in("numero_identificacion", normalizedIds),
    supabase
      .from("cursos_x_profesores")
      .select("numero_identificacion")
      .eq("id_curso", idCurso)
      .in("numero_identificacion", normalizedIds),
  ]);

  if (linkedStudentsError) {
    return { success: false, error: linkedStudentsError.message };
  }

  if (linkedProfessorsError) {
    return { success: false, error: linkedProfessorsError.message };
  }

  const linkedStudentIds = (linkedStudents ?? []).map(
    (row) => row.numero_identificacion,
  );
  const linkedProfessorIds = (linkedProfessors ?? []).map(
    (row) => row.numero_identificacion,
  );

  if (linkedStudentIds.length === 0 && linkedProfessorIds.length === 0) {
    return {
      success: false,
      error:
        "No existe vinculo para estas identificaciones en el curso seleccionado",
    };
  }

  if (linkedStudentIds.length > 0) {
    const { error } = await supabase
      .from("cursos_x_estudiantes")
      .delete()
      .eq("id_curso", idCurso)
      .in("numero_identificacion", linkedStudentIds);
    if (error) {
      return { success: false, error: error.message };
    }
  }

  if (linkedProfessorIds.length > 0) {
    const { error } = await supabase
      .from("cursos_x_profesores")
      .delete()
      .eq("id_curso", idCurso)
      .in("numero_identificacion", linkedProfessorIds);
    if (error) {
      return { success: false, error: error.message };
    }
  }

  return {
    success: true,
    removedStudentsCount: linkedStudentIds.length,
    removedProfessorsCount: linkedProfessorIds.length,
    removedCount: linkedStudentIds.length + linkedProfessorIds.length,
  };
}

export async function getParticipantsByCourseId(
  idCurso: number,
): Promise<{
  success: boolean;
  error?: string;
  data?: LinkedParticipantRow[];
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const supabase = await createClient();

  const [
    { data: linkedStudentsData, error: studentsError },
    { data: linkedProfessorsData, error: professorsError },
  ] = await Promise.all([
    supabase
      .from("cursos_x_estudiantes")
      .select(
        "numero_identificacion, estudiantes (numero_identificacion, nombres, apellidos, no_matricula, grado, tipo_identificacion)",
      )
      .eq("id_curso", idCurso),
    supabase
      .from("cursos_x_profesores")
      .select(
        "numero_identificacion, profesores (numero_identificacion, nombres, apellidos, tipo_identificacion, email)",
      )
      .eq("id_curso", idCurso),
  ]);

  if (studentsError) {
    return { success: false, error: studentsError.message };
  }

  if (professorsError) {
    return { success: false, error: professorsError.message };
  }

  const students = (
    (linkedStudentsData ?? []) as Array<{
      estudiantes:
        | {
            numero_identificacion: string;
            nombres: string;
            apellidos: string;
            no_matricula: string | null;
            grado: string;
            tipo_identificacion: string | null;
          }
        | Array<{
            numero_identificacion: string;
            nombres: string;
            apellidos: string;
            no_matricula: string | null;
            grado: string;
            tipo_identificacion: string | null;
          }>
        | null;
    }>
  )
    .map((row) =>
      Array.isArray(row.estudiantes)
        ? (row.estudiantes[0] ?? null)
        : row.estudiantes,
    )
    .filter(
      (
        student,
      ): student is {
        numero_identificacion: string;
        nombres: string;
        apellidos: string;
        no_matricula: string | null;
        grado: string;
        tipo_identificacion: string | null;
      } => Boolean(student),
    )
    .map<LinkedParticipantRow>((student) => ({
      numero_identificacion: student.numero_identificacion,
      role: "ESTUDIANTE",
      tipo_identificacion: student.tipo_identificacion,
      no_matricula: student.no_matricula,
      grado: student.grado,
      email: null,
      nombres: student.nombres,
      apellidos: student.apellidos,
    }));

  const professors = (
    (linkedProfessorsData ?? []) as Array<{
      profesores:
        | {
            numero_identificacion: string;
            nombres: string;
            apellidos: string;
            tipo_identificacion: string | null;
            email: string | null;
          }
        | Array<{
            numero_identificacion: string;
            nombres: string;
            apellidos: string;
            tipo_identificacion: string | null;
            email: string | null;
          }>
        | null;
    }>
  )
    .map((row) =>
      Array.isArray(row.profesores)
        ? (row.profesores[0] ?? null)
        : row.profesores,
    )
    .filter(
      (
        professor,
      ): professor is {
        numero_identificacion: string;
        nombres: string;
        apellidos: string;
        tipo_identificacion: string | null;
        email: string | null;
      } => Boolean(professor),
    )
    .map<LinkedParticipantRow>((professor) => ({
      numero_identificacion: professor.numero_identificacion,
      role: "PROFESOR",
      tipo_identificacion: professor.tipo_identificacion,
      no_matricula: null,
      grado: null,
      email: professor.email,
      nombres: professor.nombres,
      apellidos: professor.apellidos,
    }));

  const data = [...students, ...professors].sort((a, b) => {
    const byLastName = a.apellidos.localeCompare(b.apellidos);
    if (byLastName !== 0) return byLastName;
    const byFirstName = a.nombres.localeCompare(b.nombres);
    if (byFirstName !== 0) return byFirstName;
    return a.numero_identificacion.localeCompare(b.numero_identificacion);
  });

  return { success: true, data };
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
