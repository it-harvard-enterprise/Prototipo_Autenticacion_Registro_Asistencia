"use server";

import {
  ensureApprovedAdmin,
  ensureApprovedRoles,
} from "@/lib/auth/approved-admin";
import { callBackend } from "@/lib/backend/server-api";
import { toAppErrorMessage } from "@/lib/error-messages";
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

function toErrorMessage(error: unknown): string {
  return toAppErrorMessage(error, "Error desconocido");
}

type BackendResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  exists?: boolean;
};

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
}

export async function createCourse(
  data: CourseFormData,
): Promise<{ success: boolean; error?: string; data?: Course }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<Course>>(
      "/api/courses/create",
      {
        method: "POST",
        body: JSON.stringify({
          nombre_curso: upper(data.nombre_curso),
          nivel_curso: upper(data.nivel_curso),
          hora_inicio: data.hora_inicio,
          hora_fin: data.hora_fin,
          salon: upperOrNull(data.salon) ?? null,
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

export async function updateCourse(
  idCurso: number,
  data: Partial<CourseFormData>,
): Promise<{ success: boolean; error?: string; data?: Course }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<Course>>(
      "/api/courses/update",
      {
        method: "POST",
        body: JSON.stringify({
          id_curso: idCurso,
          data: {
            ...(data.nombre_curso !== undefined && {
              nombre_curso: upper(data.nombre_curso),
            }),
            ...(data.nivel_curso !== undefined && {
              nivel_curso: upper(data.nivel_curso),
            }),
            ...(data.hora_inicio !== undefined && {
              hora_inicio: data.hora_inicio,
            }),
            ...(data.hora_fin !== undefined && { hora_fin: data.hora_fin }),
            ...(data.salon !== undefined && { salon: upperOrNull(data.salon) }),
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

export async function deleteCourse(
  idCurso: number,
): Promise<{ success: boolean; error?: string }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<null>>(
      "/api/courses/delete",
      {
        method: "POST",
        body: JSON.stringify({ id_curso: idCurso }),
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

export async function getCourses(): Promise<{
  success: boolean;
  error?: string;
  data?: Course[];
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<Course[]>>(
      "/api/courses",
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

export async function getCourseById(
  idCurso: number,
): Promise<{ success: boolean; error?: string; data?: Course }> {
  const approval = await ensureApprovedRoles([
    "administrador",
    "profesor",
    "estudiante",
  ]);
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<Course>>(
      `/api/courses/${idCurso}`,
      {
        method: "GET",
      },
    );

    if (!payload.success || !payload.data) {
      return {
        success: false,
        error: payload.error || "No se encontró el curso",
      };
    }

    return { success: true, data: payload.data };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
}

export async function courseExists(
  idCurso: number,
): Promise<{ success: boolean; error?: string; exists?: boolean }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<null>>(
      "/api/courses/exists",
      {
        method: "POST",
        body: JSON.stringify({ id_curso: idCurso }),
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

  const normalizedIds = normalizeIdentificationIds(participantIds);
  if (normalizedIds.length === 0) {
    return { success: true, data: [] };
  }

  try {
    const payload = await callBackend<
      BackendResponse<ParticipantLookupResult[]>
    >("/api/courses/participants/lookup", {
      method: "POST",
      body: JSON.stringify({ participant_ids: normalizedIds }),
    });

    if (!payload.success) {
      return { success: false, error: payload.error || "Error desconocido" };
    }

    return { success: true, data: payload.data ?? [] };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
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

  const normalizedIds = normalizeIdentificationIds(participantIds);
  if (normalizedIds.length === 0) {
    return {
      success: false,
      error: "Debe ingresar al menos un numero_identificacion",
    };
  }

  try {
    const payload = await callBackend<
      BackendResponse<{
        insertedCount?: number;
        insertedStudentsCount?: number;
        insertedProfessorsCount?: number;
      }>
    >("/api/courses/participants/associate", {
      method: "POST",
      body: JSON.stringify({
        id_curso: idCurso,
        participant_ids: normalizedIds,
      }),
    });

    if (!payload.success) {
      return { success: false, error: payload.error || "Error desconocido" };
    }

    return {
      success: true,
      insertedCount: payload.data?.insertedCount ?? 0,
      insertedStudentsCount: payload.data?.insertedStudentsCount ?? 0,
      insertedProfessorsCount: payload.data?.insertedProfessorsCount ?? 0,
    };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
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

  const normalizedIds = normalizeIdentificationIds(participantIds);
  if (normalizedIds.length === 0) {
    return {
      success: false,
      error: "Debe ingresar al menos un numero_identificacion",
    };
  }

  try {
    const payload = await callBackend<
      BackendResponse<{
        removedCount?: number;
        removedStudentsCount?: number;
        removedProfessorsCount?: number;
      }>
    >("/api/courses/participants/dissociate", {
      method: "POST",
      body: JSON.stringify({
        id_curso: idCurso,
        participant_ids: normalizedIds,
      }),
    });

    if (!payload.success) {
      return { success: false, error: payload.error || "Error desconocido" };
    }

    return {
      success: true,
      removedCount: payload.data?.removedCount ?? 0,
      removedStudentsCount: payload.data?.removedStudentsCount ?? 0,
      removedProfessorsCount: payload.data?.removedProfessorsCount ?? 0,
    };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
}

export async function getParticipantsByCourseId(idCurso: number): Promise<{
  success: boolean;
  error?: string;
  data?: LinkedParticipantRow[];
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<LinkedParticipantRow[]>>(
      `/api/courses/${idCurso}/participants`,
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

export async function associateStudentsToCourse(
  idCurso: number,
  studentIds: string[],
): Promise<{ success: boolean; error?: string; insertedCount?: number }> {
  const result = await associateParticipantsToCourse(idCurso, studentIds);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    insertedCount: result.insertedStudentsCount ?? result.insertedCount ?? 0,
  };
}

export async function dissociateStudentsFromCourse(
  idCurso: number,
  studentIds: string[],
): Promise<{ success: boolean; error?: string; removedCount?: number }> {
  const result = await dissociateParticipantsFromCourse(idCurso, studentIds);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    removedCount: result.removedStudentsCount ?? result.removedCount ?? 0,
  };
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

  try {
    const payload = await callBackend<BackendResponse<LinkedStudentRow[]>>(
      `/api/courses/${idCurso}/students`,
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
