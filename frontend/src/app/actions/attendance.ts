"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureApprovedAdmin } from "@/lib/auth/approved-admin";

type Saldo = "cancelado" | "debe" | null;
type MetodoPago =
  | "efectivo"
  | "transferencia"
  | "nequi"
  | "daviplata"
  | "otro"
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
}

export interface AttendanceSaveRow {
  numero_identificacion: string;
  asistio: boolean;
  saldo: Saldo;
  metodo_pago: MetodoPago;
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

interface FingerprintBackendResponse {
  success: boolean;
  numero_identificacion?: string;
  confidence?: number;
  error?: string;
}

export interface FingerprintAttendanceMatch {
  success: boolean;
  matched: boolean;
  numero_identificacion?: string;
  confidence?: number;
  source?: "backend" | "local";
  error?: string;
}

function getUtcDayBounds(date: string) {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export async function identifyStudentByFingerprintForAttendance(params: {
  idCurso: number;
  fingerprintTemplate: string;
}): Promise<FingerprintAttendanceMatch> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return {
      success: false,
      matched: false,
      error: approval.error,
    };
  }

  const backendUrl = process.env.BIOMETRIC_BACKEND_URL?.trim();

  if (!backendUrl) {
    return {
      success: false,
      matched: false,
      error: "No se ha configurado BIOMETRIC_BACKEND_URL para validar huellas",
    };
  }

  try {
    const response = await fetch(`${backendUrl}/api/attendance/identify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id_curso: params.idCurso,
        fingerprint_template: params.fingerprintTemplate,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        success: false,
        matched: false,
        source: "backend",
        error: `Error del backend biometrico: ${response.status}`,
      };
    }

    const payload = (await response.json()) as FingerprintBackendResponse;
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
  } catch {
    return {
      success: false,
      matched: false,
      error: "No fue posible conectar con el backend biometrico configurado",
    };
  }
}

export async function getCourseOptions(): Promise<{
  success: boolean;
  error?: string;
  data?: CourseOption[];
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cursos")
    .select("id_curso, nombre_curso")
    .order("id_curso", { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (data ?? []) as CourseOption[] };
}

export async function getAttendanceRosterByCourseAndDate(
  idCurso: number,
  date: string,
): Promise<{
  success: boolean;
  error?: string;
  data?: AttendanceStudentRow[];
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const supabase = await createClient();

  const { startIso, endIso } = getUtcDayBounds(date);

  const { data: enrolledStudents, error: enrolledError } = await supabase
    .from("cursos_x_estudiantes")
    .select(
      "numero_identificacion, estudiantes(numero_identificacion, nombres, apellidos)",
    )
    .eq("id_curso", idCurso)
    .order("numero_identificacion", { ascending: true });

  if (enrolledError) {
    return { success: false, error: enrolledError.message };
  }

  const identifiers = (enrolledStudents ?? [])
    .map((item) => item.numero_identificacion)
    .filter(Boolean);

  if (identifiers.length === 0) {
    return { success: true, data: [] };
  }

  const { data: attendanceRows, error: attendanceError } = await supabase
    .from("registro_asistencia")
    .select("numero_identificacion, asistio, saldo, metodo_pago, fecha")
    .eq("id_curso", idCurso)
    .in("numero_identificacion", identifiers)
    .gte("fecha", startIso)
    .lt("fecha", endIso);

  if (attendanceError) {
    return { success: false, error: attendanceError.message };
  }

  const attendanceByStudent = new Map<
    string,
    { asistio: boolean; saldo: Saldo; metodo_pago: MetodoPago }
  >();

  for (const row of attendanceRows ?? []) {
    attendanceByStudent.set(row.numero_identificacion, {
      asistio: row.asistio,
      saldo: row.saldo as Saldo,
      metodo_pago: row.metodo_pago as MetodoPago,
    });
  }

  const normalizedRows: AttendanceStudentRow[] = (enrolledStudents ?? []).map(
    (item) => {
      const student = Array.isArray(item.estudiantes)
        ? item.estudiantes[0]
        : item.estudiantes;
      const attendance = attendanceByStudent.get(item.numero_identificacion);

      return {
        numero_identificacion: item.numero_identificacion,
        nombres: student?.nombres ?? "",
        apellidos: student?.apellidos ?? "",
        asistio: attendance?.asistio ?? false,
        saldo: attendance?.saldo ?? null,
        metodo_pago: attendance?.metodo_pago ?? null,
      };
    },
  );

  return { success: true, data: normalizedRows };
}

export async function saveAttendanceForCourseAndDate(params: {
  idCurso: number;
  date: string;
  rows: AttendanceSaveRow[];
}): Promise<{ success: boolean; error?: string; savedCount?: number }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const supabase = await createClient();

  const normalizedRows = params.rows
    .map((row) => {
      const numero_identificacion = row.numero_identificacion.trim();

      if (!row.asistio) {
        return {
          numero_identificacion,
          asistio: false,
          saldo: null as Saldo,
          metodo_pago: null as MetodoPago,
        };
      }

      // For autosave, keep DB-valid intermediate states while the user completes fields.
      if (row.saldo === "debe") {
        return {
          numero_identificacion,
          asistio: true,
          saldo: "debe" as Saldo,
          metodo_pago: null as MetodoPago,
        };
      }

      if (row.saldo === "cancelado" && row.metodo_pago) {
        return {
          numero_identificacion,
          asistio: true,
          saldo: "cancelado" as Saldo,
          metodo_pago: row.metodo_pago,
        };
      }

      // If saldo is still incomplete (or cancelado without metodo), persist as pending.
      return {
        numero_identificacion,
        asistio: true,
        saldo: null as Saldo,
        metodo_pago: null as MetodoPago,
      };
    })
    .filter((row) => row.numero_identificacion);

  if (normalizedRows.length === 0) {
    return { success: false, error: "No hay estudiantes para registrar" };
  }

  const { startIso, endIso } = getUtcDayBounds(params.date);

  const studentIds = normalizedRows.map((row) => row.numero_identificacion);

  const { data: existingRows, error: existingError } = await supabase
    .from("registro_asistencia")
    .select("id, numero_identificacion")
    .eq("id_curso", params.idCurso)
    .in("numero_identificacion", studentIds)
    .gte("fecha", startIso)
    .lt("fecha", endIso);

  if (existingError) {
    return { success: false, error: existingError.message };
  }

  const existingByStudent = new Map<string, number>();
  for (const row of existingRows ?? []) {
    existingByStudent.set(row.numero_identificacion, row.id);
  }

  const toUpdate = normalizedRows.filter((row) =>
    existingByStudent.has(row.numero_identificacion),
  );
  const toInsert = normalizedRows.filter(
    (row) => !existingByStudent.has(row.numero_identificacion),
  );

  for (const row of toUpdate) {
    const id = existingByStudent.get(row.numero_identificacion);
    if (!id) continue;

    const { error } = await supabase
      .from("registro_asistencia")
      .update({
        asistio: row.asistio,
        saldo: row.asistio ? row.saldo : null,
        metodo_pago:
          row.asistio && row.saldo === "cancelado" ? row.metodo_pago : null,
      })
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }
  }

  if (toInsert.length > 0) {
    const payload = toInsert.map((row) => ({
      numero_identificacion: row.numero_identificacion,
      id_curso: params.idCurso,
      fecha: startIso,
      asistio: row.asistio,
      saldo: row.asistio ? row.saldo : null,
      metodo_pago:
        row.asistio && row.saldo === "cancelado" ? row.metodo_pago : null,
    }));

    const { error } = await supabase
      .from("registro_asistencia")
      .insert(payload);

    if (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: true, savedCount: normalizedRows.length };
}

export async function getAttendanceExportByCourseAndDate(
  idCurso: number,
  date: string,
): Promise<{
  success: boolean;
  error?: string;
  data?: AttendanceExportRow[];
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const supabase = await createClient();
  const { startIso, endIso } = getUtcDayBounds(date);

  const { data, error } = await supabase
    .from("registro_asistencia")
    .select(
      "id, id_curso, numero_identificacion, fecha, asistio, saldo, metodo_pago, estudiantes(tipo_identificacion, nombres, apellidos), cursos(nombre_curso)",
    )
    .eq("id_curso", idCurso)
    .gte("fecha", startIso)
    .lt("fecha", endIso)
    .order("numero_identificacion", { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  const rows: AttendanceExportRow[] = (data ?? []).map((row) => {
    const student = Array.isArray(row.estudiantes)
      ? row.estudiantes[0]
      : row.estudiantes;
    const course = Array.isArray(row.cursos) ? row.cursos[0] : row.cursos;

    return {
      id: row.id,
      id_curso: row.id_curso,
      nombre_curso: course?.nombre_curso ?? "",
      tipo_identificacion: student?.tipo_identificacion ?? null,
      numero_identificacion: row.numero_identificacion,
      nombres: student?.nombres ?? "",
      apellidos: student?.apellidos ?? "",
      fecha: row.fecha,
      asistio: row.asistio,
      saldo: row.saldo as Saldo,
      metodo_pago: row.metodo_pago as MetodoPago,
    };
  });

  return { success: true, data: rows };
}
