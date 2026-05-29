import { NextRequest, NextResponse } from "next/server";

import { ensureApprovedRoles } from "@/lib/auth/approved-admin";
import { callBackendRaw } from "@/lib/backend/server-api";

type BackendRosterResponse = {
  success?: boolean;
  data?: unknown;
  error?: string;
};

export async function GET(request: NextRequest) {
  const approval = await ensureApprovedRoles(["administrador", "profesor"]);
  if (!approval.ok) {
    return NextResponse.json(
      { success: false, error: approval.error },
      { status: 401 },
    );
  }

  const idCurso = Number(request.nextUrl.searchParams.get("id_curso") ?? 0);
  const periodId = Number(request.nextUrl.searchParams.get("period_id") ?? 0);

  if (!Number.isInteger(idCurso) || idCurso <= 0) {
    return NextResponse.json(
      { success: false, error: "id_curso invalido" },
      { status: 400 },
    );
  }

  if (!Number.isInteger(periodId) || periodId <= 0) {
    return NextResponse.json(
      { success: false, error: "period_id invalido" },
      { status: 400 },
    );
  }

  try {
    const query = new URLSearchParams({
      id_curso: String(idCurso),
      period_id: String(periodId),
    });

    const response = await callBackendRaw(
      `/api/grades/roster?${query.toString()}`,
      {
        method: "GET",
      },
    );

    const payload = (await response
      .json()
      .catch(() => null)) as BackendRosterResponse | null;

    if (!response.ok || !payload?.success || !payload.data) {
      return NextResponse.json(
        {
          success: false,
          error: payload?.error ?? "No fue posible cargar la planilla",
        },
        { status: response.status || 500 },
      );
    }

    return NextResponse.json({ success: true, data: payload.data });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "No fue posible conectar con el backend para cargar la planilla",
      },
      { status: 502 },
    );
  }
}
