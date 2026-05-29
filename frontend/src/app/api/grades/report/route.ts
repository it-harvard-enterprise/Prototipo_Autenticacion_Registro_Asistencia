import { NextRequest, NextResponse } from "next/server";

import { ensureApprovedRoles } from "@/lib/auth/approved-admin";
import { callBackendRaw } from "@/lib/backend/server-api";

export async function GET(request: NextRequest) {
  const approval = await ensureApprovedRoles(["administrador", "profesor"]);
  if (!approval.ok) {
    return NextResponse.json(
      { success: false, error: approval.error },
      { status: 401 },
    );
  }

  const query = request.nextUrl.searchParams;
  const idCurso = Number(query.get("id_curso") ?? 0);
  const periodId = Number(query.get("period_id") ?? 0);
  const numeroIdentificacion =
    query.get("numero_identificacion")?.trim().toUpperCase() ?? "";

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
    const backendQuery = new URLSearchParams({
      id_curso: String(idCurso),
      period_id: String(periodId),
    });

    if (numeroIdentificacion) {
      backendQuery.set("numero_identificacion", numeroIdentificacion);
    }

    const response = await callBackendRaw(
      `/api/grades/report?${backendQuery.toString()}`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      return NextResponse.json(
        {
          success: false,
          error:
            payload?.error ?? "No fue posible generar el boletin academico",
        },
        { status: response.status || 500 },
      );
    }

    const pdfBuffer = await response.arrayBuffer();
    const contentType =
      response.headers.get("content-type") || "application/pdf";
    const contentDisposition =
      response.headers.get("content-disposition") ||
      'attachment; filename="boletin-academico.pdf"';

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:
          "No fue posible conectar con el backend para generar el boletin academico",
      },
      { status: 502 },
    );
  }
}
