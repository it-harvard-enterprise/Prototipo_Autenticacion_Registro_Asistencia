"use server";

import { ensureApprovedRoles } from "@/lib/auth/approved-admin";
import { resolveCurrentUserAccess } from "@/lib/auth/resolved-access";
import { callBackend } from "@/lib/backend/server-api";
import { toAppErrorMessage } from "@/lib/error-messages";
import { getCourseOptions, type CourseOption } from "@/app/actions/attendance";

type BackendResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export interface AcademicPeriod {
  id: number;
  period_label: string;
  period_year: number;
  period_term: number;
  fecha_inicio: string;
  fecha_fin: string;
  auto_generado: boolean;
}

export interface GradesPeriodsPayload {
  periods: AcademicPeriod[];
  selected_period_id: number | null;
}

export interface GradeRosterCourse {
  id_curso: number;
  nombre_curso: string;
  hora_inicio: string;
  hora_fin: string;
  salon: string | null;
}

export interface GradeRosterProfessor {
  numero_identificacion: string;
  tipo_identificacion: string | null;
  nombres: string;
  apellidos: string;
  firma_docente_data_url: string | null;
}

export interface GradeStudentRow {
  numero_identificacion: string;
  tipo_identificacion: string | null;
  nombres: string;
  apellidos: string;
  ingles_speaking_1: number | null;
  ingles_speaking_2: number | null;
  ingles_listening_1: number | null;
  ingles_listening_2: number | null;
  ingles_writing_1: number | null;
  ingles_writing_2: number | null;
  ingles_reading_1: number | null;
  ingles_reading_2: number | null;
  ingles_grammar_1: number | null;
  ingles_grammar_2: number | null;
  ingles_definitiva: number | null;
  ingles_comentarios_docente: string | null;
  matematicas_pro: number | null;
  matematicas_sol: number | null;
  matematicas_com: number | null;
  matematicas_raz: number | null;
  matematicas_definitiva: number | null;
  matematicas_comentarios_docente: string | null;
  sistemas_definitiva: number | null;
  sistemas_notas_docente: string | null;
  comentarios_generales_docente: string | null;
}

export interface GradesRosterPayload {
  period: AcademicPeriod;
  course: GradeRosterCourse;
  professor: GradeRosterProfessor | null;
  students: GradeStudentRow[];
}

export interface CourseMaterialsGradesViewPayload {
  viewer_role: "administrador" | "profesor" | "estudiante";
  period: AcademicPeriod;
  course: GradeRosterCourse;
  students: GradeStudentRow[];
}

export interface GradeSavePayload {
  id_curso: number;
  period_id: number;
  rows: GradeStudentRow[];
  update_definitivas?: boolean;
}

function toErrorMessage(error: unknown): string {
  return toAppErrorMessage(error, "Error desconocido");
}

function parseMetadataIdentification(
  metadata?: Record<string, unknown>,
): string {
  if (!metadata) {
    return "";
  }

  const candidates = [
    metadata.numero_identificacion,
    metadata.numeroIdentificacion,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim().toUpperCase();
    }
  }

  return "";
}

function normalizeGradeValue(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const rounded = Math.round(parsed * 100) / 100;
  if (rounded < 0 || rounded > 5) {
    return null;
  }

  return rounded;
}

function normalizeTextValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toSaveRow(row: GradeStudentRow) {
  return {
    numero_identificacion: row.numero_identificacion.trim().toUpperCase(),
    ingles_speaking_1: normalizeGradeValue(row.ingles_speaking_1),
    ingles_speaking_2: normalizeGradeValue(row.ingles_speaking_2),
    ingles_listening_1: normalizeGradeValue(row.ingles_listening_1),
    ingles_listening_2: normalizeGradeValue(row.ingles_listening_2),
    ingles_writing_1: normalizeGradeValue(row.ingles_writing_1),
    ingles_writing_2: normalizeGradeValue(row.ingles_writing_2),
    ingles_reading_1: normalizeGradeValue(row.ingles_reading_1),
    ingles_reading_2: normalizeGradeValue(row.ingles_reading_2),
    ingles_grammar_1: normalizeGradeValue(row.ingles_grammar_1),
    ingles_grammar_2: normalizeGradeValue(row.ingles_grammar_2),
    ingles_definitiva: normalizeGradeValue(row.ingles_definitiva),
    ingles_comentarios_docente: normalizeTextValue(
      row.ingles_comentarios_docente,
    ),
    matematicas_pro: normalizeGradeValue(row.matematicas_pro),
    matematicas_sol: normalizeGradeValue(row.matematicas_sol),
    matematicas_com: normalizeGradeValue(row.matematicas_com),
    matematicas_raz: normalizeGradeValue(row.matematicas_raz),
    matematicas_definitiva: normalizeGradeValue(row.matematicas_definitiva),
    matematicas_comentarios_docente: normalizeTextValue(
      row.matematicas_comentarios_docente,
    ),
    sistemas_definitiva: normalizeGradeValue(row.sistemas_definitiva),
    sistemas_notas_docente: normalizeTextValue(row.sistemas_notas_docente),
    comentarios_generales_docente: normalizeTextValue(
      row.comentarios_generales_docente,
    ),
  };
}

export async function getGradesCourseOptions(): Promise<{
  success: boolean;
  error?: string;
  data?: CourseOption[];
}> {
  return getCourseOptions();
}

export async function getAcademicPeriods(): Promise<{
  success: boolean;
  error?: string;
  data?: GradesPeriodsPayload;
}> {
  const approval = await ensureApprovedRoles(["administrador", "profesor"]);
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const payload = await callBackend<BackendResponse<GradesPeriodsPayload>>(
      "/api/grades/periods",
      {
        method: "GET",
      },
    );

    if (!payload.success || !payload.data) {
      return {
        success: false,
        error: payload.error ?? "No fue posible cargar periodos academicos",
      };
    }

    return { success: true, data: payload.data };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function createAcademicPeriod(params: {
  year: number;
  term: 1 | 2;
}): Promise<{
  success: boolean;
  error?: string;
  data?: AcademicPeriod;
}> {
  const approval = await ensureApprovedRoles(["administrador", "profesor"]);
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const createdBy = approval.access?.user?.id?.trim() || null;

  try {
    const payload = await callBackend<BackendResponse<AcademicPeriod>>(
      "/api/grades/periods",
      {
        method: "POST",
        body: JSON.stringify({
          year: params.year,
          term: params.term,
          created_by: createdBy,
        }),
      },
    );

    if (!payload.success || !payload.data) {
      return {
        success: false,
        error: payload.error ?? "No fue posible crear el periodo academico",
      };
    }

    return { success: true, data: payload.data };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function getGradesRoster(params: {
  idCurso: number;
  periodId: number;
}): Promise<{
  success: boolean;
  error?: string;
  data?: GradesRosterPayload;
}> {
  const approval = await ensureApprovedRoles(["administrador", "profesor"]);
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  if (!Number.isInteger(params.idCurso) || params.idCurso <= 0) {
    return { success: false, error: "id_curso invalido" };
  }

  if (!Number.isInteger(params.periodId) || params.periodId <= 0) {
    return { success: false, error: "period_id invalido" };
  }

  try {
    const query = new URLSearchParams({
      id_curso: String(params.idCurso),
      period_id: String(params.periodId),
    });

    const payload = await callBackend<BackendResponse<GradesRosterPayload>>(
      `/api/grades/roster?${query.toString()}`,
      {
        method: "GET",
      },
    );

    if (!payload.success || !payload.data) {
      return {
        success: false,
        error: payload.error ?? "No fue posible cargar la planilla de notas",
      };
    }

    return { success: true, data: payload.data };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function saveGrades(params: GradeSavePayload): Promise<{
  success: boolean;
  error?: string;
  savedCount?: number;
}> {
  const approval = await ensureApprovedRoles(["administrador", "profesor"]);
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  if (!Number.isInteger(params.id_curso) || params.id_curso <= 0) {
    return { success: false, error: "id_curso invalido" };
  }

  if (!Number.isInteger(params.period_id) || params.period_id <= 0) {
    return { success: false, error: "period_id invalido" };
  }

  if (!Array.isArray(params.rows) || params.rows.length === 0) {
    return { success: false, error: "No hay filas para guardar" };
  }

  const updatedBy = approval.access?.user?.id?.trim() || null;

  try {
    const payload = await callBackend<
      BackendResponse<{ savedCount?: number; definitives_updated?: boolean }>
    >("/api/grades/save", {
      method: "POST",
      body: JSON.stringify({
        id_curso: params.id_curso,
        period_id: params.period_id,
        rows: params.rows.map(toSaveRow),
        updated_by: updatedBy,
        update_definitivas: params.update_definitivas === true,
      }),
    });

    if (!payload.success) {
      return {
        success: false,
        error: payload.error ?? "No fue posible guardar calificaciones",
      };
    }

    return {
      success: true,
      savedCount: payload.data?.savedCount ?? 0,
    };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function updateProfessorSignature(params: {
  numeroIdentificacion: string;
  signatureDataUrl: string | null;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  const approval = await ensureApprovedRoles(["administrador", "profesor"]);
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const numeroIdentificacion = params.numeroIdentificacion.trim().toUpperCase();
  if (!numeroIdentificacion) {
    return {
      success: false,
      error: "numero_identificacion es obligatorio",
    };
  }

  if (approval.access?.role === "profesor") {
    const ownNumero = parseMetadataIdentification(
      approval.access.user?.user_metadata,
    );

    if (!ownNumero || ownNumero !== numeroIdentificacion) {
      return {
        success: false,
        error: "Un profesor solo puede actualizar su propia firma",
      };
    }
  }

  const updatedBy = approval.access?.user?.id?.trim() || null;

  try {
    const payload = await callBackend<BackendResponse<unknown>>(
      "/api/grades/professor-signature",
      {
        method: "POST",
        body: JSON.stringify({
          numero_identificacion: numeroIdentificacion,
          signature_data_url: params.signatureDataUrl,
          updated_by: updatedBy,
        }),
      },
    );

    if (!payload.success) {
      return {
        success: false,
        error: payload.error ?? "No fue posible actualizar la firma",
      };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function getGradesViewerContext(): Promise<{
  success: boolean;
  error?: string;
  data?: {
    role: "administrador" | "profesor";
    numeroIdentificacion?: string;
  };
}> {
  const access = await resolveCurrentUserAccess();

  if (!access.user) {
    return { success: false, error: "Debe iniciar sesion para continuar." };
  }

  if (!access.approved) {
    return {
      success: false,
      error: "Su usuario no esta aprobado para esta funcionalidad.",
    };
  }

  if (access.role !== "administrador" && access.role !== "profesor") {
    return {
      success: false,
      error: "No tiene permisos para esta funcionalidad.",
    };
  }

  const numeroIdentificacion = parseMetadataIdentification(
    access.user.user_metadata,
  );

  return {
    success: true,
    data: {
      role: access.role,
      numeroIdentificacion: numeroIdentificacion || undefined,
    },
  };
}

export async function getCourseGradesForMaterialsView(
  idCurso: number,
): Promise<{
  success: boolean;
  error?: string;
  data?: CourseMaterialsGradesViewPayload;
}> {
  const approval = await ensureApprovedRoles([
    "administrador",
    "profesor",
    "estudiante",
  ]);
  if (!approval.ok || !approval.access?.role) {
    return { success: false, error: approval.error };
  }

  if (!Number.isInteger(idCurso) || idCurso <= 0) {
    return { success: false, error: "id_curso invalido" };
  }

  try {
    const periodsPayload = await callBackend<
      BackendResponse<GradesPeriodsPayload>
    >("/api/grades/periods", {
      method: "GET",
    });

    if (!periodsPayload.success || !periodsPayload.data) {
      return {
        success: false,
        error:
          periodsPayload.error ?? "No fue posible cargar periodos academicos",
      };
    }

    const selectedPeriod =
      periodsPayload.data.periods.find(
        (item) => item.id === periodsPayload.data?.selected_period_id,
      ) ?? periodsPayload.data.periods[0];

    if (!selectedPeriod) {
      return {
        success: false,
        error: "No hay periodos academicos disponibles",
      };
    }

    const query = new URLSearchParams({
      id_curso: String(idCurso),
      period_id: String(selectedPeriod.id),
    });

    const rosterPayload = await callBackend<
      BackendResponse<GradesRosterPayload>
    >(`/api/grades/roster?${query.toString()}`, {
      method: "GET",
    });

    if (!rosterPayload.success || !rosterPayload.data) {
      return {
        success: false,
        error: rosterPayload.error ?? "No fue posible cargar calificaciones",
      };
    }

    let visibleStudents = rosterPayload.data.students ?? [];

    if (approval.access.role === "estudiante") {
      const ownNumero = parseMetadataIdentification(
        approval.access.user?.user_metadata,
      );

      if (!ownNumero) {
        return {
          success: false,
          error:
            "No fue posible identificar su numero de documento para filtrar calificaciones",
        };
      }

      visibleStudents = visibleStudents.filter(
        (row) => row.numero_identificacion.trim().toUpperCase() === ownNumero,
      );
    }

    return {
      success: true,
      data: {
        viewer_role: approval.access.role,
        period: rosterPayload.data.period,
        course: rosterPayload.data.course,
        students: visibleStudents,
      },
    };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}
