import { NextResponse } from "next/server";

import { ensureApprovedAdmin } from "@/lib/auth/approved-admin";
import { callBackend } from "@/lib/backend/server-api";

function upper(value: string): string {
  return value.trim().toUpperCase();
}

type BackendCreateStudentResponse = {
  success: boolean;
  data?: unknown;
  error?: string;
  auth_user_id?: string;
  requires_password_change?: boolean;
};

export async function POST(req: Request) {
  try {
    const approval = await ensureApprovedAdmin();
    if (!approval.ok) {
      return NextResponse.json(
        { success: false, error: approval.error },
        { status: 403 },
      );
    }

    const payload = (await req.json()) as Record<string, unknown>;
    const numeroIdentificacion = upper(
      String(payload.numero_identificacion ?? ""),
    );
    const tipoIdentificacion = upper(
      String(payload.tipo_identificacion ?? "CC"),
    );
    const email = String(payload.email ?? "")
      .trim()
      .toLowerCase();

    if (!numeroIdentificacion) {
      return NextResponse.json(
        {
          success: false,
          error: "El número de identificación es obligatorio.",
        },
        { status: 400 },
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: "El correo electrónico del estudiante es obligatorio.",
        },
        { status: 400 },
      );
    }

    const backendPayload = await callBackend<BackendCreateStudentResponse>(
      "/api/students/create",
      {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          numero_identificacion: numeroIdentificacion,
          tipo_identificacion: tipoIdentificacion,
          email,
        }),
      },
    );

    if (!backendPayload.success) {
      return NextResponse.json(
        {
          success: false,
          error: backendPayload.error ?? "No fue posible crear el estudiante",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(backendPayload, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}
