"use server";

import { ensureApprovedRoles } from "@/lib/auth/approved-admin";
import { resolveCurrentUserAccess } from "@/lib/auth/resolved-access";
import { callBackend } from "@/lib/backend/server-api";
import { toAppErrorMessage } from "@/lib/error-messages";

type Saldo = "cancelado" | "debe" | null;
type MetodoPago =
  | "EFECTIVO"
  | "TRANSFERENCIA"
  | "NEQUI"
  | "DAVIPLATA"
  | "OTRO"
  | null;

export interface CourseOption {
  id_curso: number;
  nombre_curso: string;
}

export interface AttendanceStudentRow {
  numero_identificacion: string;
  nombres: string;
  apellidos: string;
  asistio: boolean;
  saldo: Saldo;
  metodo_pago: MetodoPago;
  marcado_en: string | null;
}

export interface AttendanceSaveRow {
  numero_identificacion: string;
  asistio: boolean;
  saldo: Saldo;
  metodo_pago: MetodoPago;
  marcado_en?: string | null;
}

export interface AttendanceExportRow {
  id: number;
  id_curso: number;
  nombre_curso: string;
  tipo_identificacion: string | null;
  numero_identificacion: string;
  nombres: string;
  apellidos: string;
  fecha: string;
  asistio: boolean;
  saldo: Saldo;
  metodo_pago: MetodoPago;
}

export interface AttendanceDateOption {
  date: string;
}

interface FingerprintBackendResponse {
  success: boolean;
  numero_identificacion?: string | null;
  confidence?: number;
  error?: string;
}

interface BackendResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  exists?: boolean;
}

export interface FingerprintAttendanceMatch {
  success: boolean;
  matched: boolean;
  numero_identificacion?: string;
  confidence?: number;
  source?: "backend" | "local";
  error?: string;
}

function toErrorMessage(error: unknown): string {
  return toAppErrorMessage(error, "Error desconocido");
}

function normalizeAttendanceRows(
  rows: AttendanceSaveRow[],
): AttendanceSaveRow[] {
  return rows
    .map((row) => ({
      ...row,
      numero_identificacion: row.numero_identificacion.trim().toUpperCase(),
      marcado_en: row.marcado_en ?? null,
    }))
    .filter((row) => row.numero_identificacion.length > 0);
}

export async function identifyStudentByFingerprintForAttendance(params: {
  idCurso: number;
  fingerprintTemplate: string;
}): Promise<FingerprintAttendanceMatch> {
  const approval = await ensureApprovedRoles(["administrador", "profesor"]);
  if (!approval.ok) {
    return {
      success: false,
      matched: false,
      error: approval.error,
    };
  }

  try {
    const payload = await callBackend<FingerprintBackendResponse>(
      "/api/attendance/identify",
      {
        method: "POST",
        body: JSON.stringify({
          id_curso: params.idCurso,
          fingerprint_template: params.fingerprintTemplate,
        }),
      },
    );

    if (!payload.success) {
      return {
        success: false,
        matched: false,
        source: "backend",
        error: payload.error ?? "No fue posible validar la huella",
      };
    }

    if (!payload.numero_identificacion) {
      return {
        success: true,
        matched: false,
        source: "backend",
        confidence: payload.confidence,
        error: "No hubo coincidencia de huella",
      };
    }

    return {
      success: true,
      matched: true,
      numero_identificacion: payload.numero_identificacion,
      confidence: payload.confidence,
      source: "backend",
    };
  } catch (error) {
    return {
      success: false,
      matched: false,
      source: "backend",
      error: toErrorMessage(error),
    };
  }
}

export async function getCourseOptions(): Promise<{
  success: boolean;
  error?: string;
  data?: CourseOption[];
}> {
  const approval = await ensureApprovedRoles(["administrador", "profesor"]);
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<CourseOption[]>>(
      "/api/courses/options",
      {
        method: "GET",
      },
    );

    if (!payload.success) {
      return { success: false, error: payload.error || "Error desconocido" };
    }

    return { success: true, data: payload.data ?? [] };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function getAttendanceRosterByCourseAndDate(
  idCurso: number,
  date: string,
): Promise<{
  success: boolean;
  error?: string;
  data?: AttendanceStudentRow[];
}> {
  const approval = await ensureApprovedRoles(["administrador", "profesor"]);
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const query = new URLSearchParams({
      id_curso: String(idCurso),
      date,
    });

    const payload = await callBackend<BackendResponse<AttendanceStudentRow[]>>(
      `/api/attendance/roster?${query.toString()}`,
      {
        method: "GET",
      },
    );

    if (!payload.success) {
      return { success: false, error: payload.error || "Error desconocido" };
    }

    return { success: true, data: payload.data ?? [] };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function saveAttendanceForCourseAndDate(params: {
  idCurso: number;
  date: string;
  rows: AttendanceSaveRow[];
  saveTimestampIso?: string;
}): Promise<{ success: boolean; error?: string; savedCount?: number }> {
  const approval = await ensureApprovedRoles(["administrador", "profesor"]);
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const normalizedRows = normalizeAttendanceRows(params.rows);
  if (normalizedRows.length === 0) {
    return { success: false, error: "No hay estudiantes para registrar" };
  }

  const access = await resolveCurrentUserAccess();
  const registradoPor = access.user?.id?.trim() || null;

  try {
    const payload = await callBackend<
      BackendResponse<{
        savedCount?: number;
      }>
    >("/api/attendance/save", {
      method: "POST",
      body: JSON.stringify({
        id_curso: params.idCurso,
        date: params.date,
        rows: normalizedRows,
        save_timestamp_iso: params.saveTimestampIso?.trim() || null,
        registrado_por: registradoPor,
      }),
    });

    if (!payload.success) {
      return { success: false, error: payload.error || "Error desconocido" };
    }

    return { success: true, savedCount: payload.data?.savedCount ?? 0 };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function deleteAttendanceForCourseAndDate(params: {
  idCurso: number;
  date: string;
}): Promise<{ success: boolean; error?: string; deletedCount?: number }> {
  const approval = await ensureApprovedRoles(["administrador", "profesor"]);
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<
      BackendResponse<{
        deletedCount?: number;
      }>
    >("/api/attendance/delete", {
      method: "POST",
      body: JSON.stringify({
        id_curso: params.idCurso,
        date: params.date,
      }),
    });

    if (!payload.success) {
      return { success: false, error: payload.error || "Error desconocido" };
    }

    return { success: true, deletedCount: payload.data?.deletedCount ?? 0 };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function getAttendanceExportByCourseAndDate(
  idCurso: number,
  date: string,
): Promise<{
  success: boolean;
  error?: string;
  data?: AttendanceExportRow[];
}> {
  const approval = await ensureApprovedRoles(["administrador", "profesor"]);
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const query = new URLSearchParams({
      id_curso: String(idCurso),
      date,
    });

    const payload = await callBackend<BackendResponse<AttendanceExportRow[]>>(
      `/api/attendance/export?${query.toString()}`,
      {
        method: "GET",
      },
    );

    if (!payload.success) {
      return { success: false, error: payload.error || "Error desconocido" };
    }

    return { success: true, data: payload.data ?? [] };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function getAttendanceDatesByCourse(idCurso: number): Promise<{
  success: boolean;
  error?: string;
  data?: AttendanceDateOption[];
}> {
  const approval = await ensureApprovedRoles(["administrador", "profesor"]);
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  if (!Number.isInteger(idCurso) || idCurso <= 0) {
    return { success: false, error: "id_curso invalido" };
  }

  try {
    const query = new URLSearchParams({
      id_curso: String(idCurso),
    });

    const payload = await callBackend<BackendResponse<string[]>>(
      `/api/attendance/dates?${query.toString()}`,
      {
        method: "GET",
      },
    );

    if (!payload.success) {
      return { success: false, error: payload.error || "Error desconocido" };
    }

    return {
      success: true,
      data: (payload.data ?? []).map((date) => ({ date })),
    };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}
