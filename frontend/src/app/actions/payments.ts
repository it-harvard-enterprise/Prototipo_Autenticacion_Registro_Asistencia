"use server";

import { ensureApprovedAdmin } from "@/lib/auth/approved-admin";
import { resolveCurrentUserAccess } from "@/lib/auth/resolved-access";
import { callBackend } from "@/lib/backend/server-api";
import { toAppErrorMessage } from "@/lib/error-messages";
import { Student } from "@/lib/types";

export type PaymentMethod =
  | "EFECTIVO"
  | "TRANSFERENCIA"
  | "NEQUI"
  | "DAVIPLATA"
  | "OTRO";

export type PaymentMode = "DEUDA_TOTAL" | "DEUDA_PARCIAL" | "ADELANTO";
export type PaymentSource = "asistencia" | "procesador";
export type PaymentReportScope = "ASISTENCIA" | "PROCESADOR" | "AMBOS";
export type PaymentTypeDetail =
  | "clase_presencial"
  | "adelanto"
  | "abono_matricula"
  | "otro"
  | "pago_deuda";

export interface PaymentReportRow {
  id: string;
  fecha_pago: string;
  estudiante: string;
  numero_identificacion: string;
  nombre_curso: string | null;
  origen_pago: PaymentSource;
  tipo_pago: PaymentTypeDetail;
  tipo_pago_detalle?: PaymentTypeDetail;
  metodo_pago: PaymentMethod;
  valor: number;
  clases_adelantadas: number;
  registrado_por_id?: string;
  registrado_por: string;
  /** Nombre completo resuelto server-side desde profiles/administrador. */
  registrado_por_nombre?: string | null;
  notas: string | null;
}

interface BackendResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface StudentPaymentStatusData {
  student: Student;
  recent_payments?: PaymentReportRow[];
}

interface ProcessStudentPaymentData {
  payment?: Record<string, unknown>;
  student: Student;
}

function toErrorMessage(error: unknown): string {
  return toAppErrorMessage(error, "Error desconocido");
}

function normalizeId(value: string): string {
  return value.trim().toUpperCase();
}

export async function getStudentPaymentStatus(
  numeroIdentificacion: string,
): Promise<{
  success: boolean;
  error?: string;
  data?: StudentPaymentStatusData;
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const normalized = normalizeId(numeroIdentificacion);
  if (!normalized) {
    return {
      success: false,
      error: "Debe ingresar un número de identificación válido",
    };
  }

  try {
    const payload = await callBackend<
      BackendResponse<StudentPaymentStatusData>
    >(`/api/payments/student/${encodeURIComponent(normalized)}/status`, {
      method: "GET",
    });

    if (!payload.success || !payload.data) {
      return {
        success: false,
        error: payload.error ?? "No se encontró el estudiante",
      };
    }

    return { success: true, data: payload.data };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function processStudentPayment(params: {
  numeroIdentificacion: string;
  modalidad: PaymentMode;
  metodoPago: PaymentMethod;
  clases: number;
  notas?: string;
  idCurso?: number | null;
}): Promise<{
  success: boolean;
  error?: string;
  data?: ProcessStudentPaymentData;
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const access = await resolveCurrentUserAccess();
  if (!access.user?.id) {
    return {
      success: false,
      error: "No fue posible resolver el usuario administrador actual",
    };
  }

  const normalized = normalizeId(params.numeroIdentificacion);
  if (!normalized) {
    return {
      success: false,
      error: "Debe ingresar un número de identificación válido",
    };
  }

  try {
    const payload = await callBackend<
      BackendResponse<ProcessStudentPaymentData>
    >("/api/payments/process", {
      method: "POST",
      body: JSON.stringify({
        numero_identificacion: normalized,
        registrado_por: access.user.id,
        modalidad: params.modalidad,
        metodo_pago: params.metodoPago,
        clases: params.clases,
        notas: params.notas?.trim() || null,
        id_curso:
          typeof params.idCurso === "number" && params.idCurso > 0
            ? params.idCurso
            : null,
      }),
    });

    if (!payload.success || !payload.data) {
      return {
        success: false,
        error: payload.error ?? "No fue posible procesar el pago",
      };
    }

    return {
      success: true,
      data: payload.data,
    };
  } catch (error) {
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

export async function updateStudentPaymentStatusManual(params: {
  numeroIdentificacion: string;
  clasesAdeudadas: number;
  clasesAdelantadas: number;
  notas?: string;
}): Promise<{
  success: boolean;
  error?: string;
  data?: { student: Student };
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const normalized = normalizeId(params.numeroIdentificacion);
  if (!normalized) {
    return {
      success: false,
      error: "Debe ingresar un número de identificación válido",
    };
  }

  try {
    const payload = await callBackend<BackendResponse<{ student: Student }>>(
      "/api/payments/manual-status",
      {
        method: "POST",
        body: JSON.stringify({
          numero_identificacion: normalized,
          clases_adeudadas: Math.max(0, Math.trunc(params.clasesAdeudadas)),
          clases_adelantadas: Math.max(0, Math.trunc(params.clasesAdelantadas)),
          notas: params.notas?.trim() || null,
        }),
      },
    );

    if (!payload.success || !payload.data) {
      return {
        success: false,
        error: payload.error ?? "No fue posible actualizar el estado de pagos",
      };
    }

    return {
      success: true,
      data: payload.data,
    };
  } catch (error) {
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

export async function getPaymentsReport(params?: {
  numeroIdentificacion?: string;
  from?: string;
  to?: string;
  scope?: PaymentReportScope;
  limit?: number;
}): Promise<{
  success: boolean;
  error?: string;
  data?: PaymentReportRow[];
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const query = new URLSearchParams();
    if (params?.numeroIdentificacion) {
      query.set(
        "numero_identificacion",
        normalizeId(params.numeroIdentificacion),
      );
    }
    if (params?.from) {
      query.set("from", params.from.trim());
    }
    if (params?.to) {
      query.set("to", params.to.trim());
    }
    if (params?.scope && params.scope !== "AMBOS") {
      query.set("scope", params.scope);
    }
    query.set(
      "limit",
      String(params?.limit && params.limit > 0 ? params.limit : 50),
    );

    const payload = await callBackend<BackendResponse<PaymentReportRow[]>>(
      `/api/payments/report?${query.toString()}`,
      {
        method: "GET",
      },
    );

    if (!payload.success) {
      return {
        success: false,
        error: payload.error ?? "No fue posible consultar el reporte de pagos",
      };
    }

    return {
      success: true,
      data: payload.data ?? [],
    };
  } catch (error) {
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}
