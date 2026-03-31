import { NextRequest, NextResponse } from "next/server";

import { ensureApprovedAdmin } from "@/lib/auth/approved-admin";

type FingerprintBackendResponse = {
  success: boolean;
  numero_identificacion?: string;
  confidence?: number;
  error?: string;
};

type IdentifyRequestBody = {
  idCurso?: number;
  fingerprintTemplate?: string;
};

export async function POST(request: NextRequest) {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return NextResponse.json(
      {
        success: false,
        matched: false,
        error: approval.error,
      },
      { status: 401 },
    );
  }

  const body = (await request
    .json()
    .catch(() => null)) as IdentifyRequestBody | null;
  const idCurso = Number(body?.idCurso ?? 0);
  const fingerprintTemplate = (body?.fingerprintTemplate ?? "").trim();

  if (!Number.isInteger(idCurso) || idCurso <= 0) {
    return NextResponse.json(
      {
        success: false,
        matched: false,
        error: "idCurso invalido",
      },
      { status: 400 },
    );
  }

  if (!fingerprintTemplate) {
    return NextResponse.json(
      {
        success: false,
        matched: false,
        error: "fingerprintTemplate es requerido",
      },
      { status: 400 },
    );
  }

  const backendUrl = process.env.BIOMETRIC_BACKEND_URL?.trim();
  if (!backendUrl) {
    return NextResponse.json(
      {
        success: false,
        matched: false,
        error:
          "No se ha configurado BIOMETRIC_BACKEND_URL para validar huellas",
      },
      { status: 500 },
    );
  }

  const backendAccessKey = process.env.BIOMETRIC_BACKEND_ACCESS_KEY?.trim();
  const frontendOrigin = request.nextUrl.origin;

  try {
    const response = await fetch(`${backendUrl}/api/attendance/identify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Frontend-Origin": frontendOrigin,
        ...(backendAccessKey
          ? {
              "X-Backend-Access-Key": backendAccessKey,
            }
          : {}),
      },
      body: JSON.stringify({
        id_curso: idCurso,
        fingerprint_template: fingerprintTemplate,
      }),
      cache: "no-store",
    });

    const payload = (await response
      .json()
      .catch(() => null)) as FingerprintBackendResponse | null;

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          matched: false,
          source: "backend",
          error:
            payload?.error ??
            `Error del backend biometrico: ${response.status}`,
        },
        { status: response.status },
      );
    }

    if (!payload?.success) {
      return NextResponse.json(
        {
          success: false,
          matched: false,
          source: "backend",
          error: payload?.error ?? "No fue posible validar la huella",
        },
        { status: 502 },
      );
    }

    if (!payload.numero_identificacion) {
      return NextResponse.json({
        success: true,
        matched: false,
        source: "backend",
        confidence: payload.confidence,
        error: "No hubo coincidencia de huella",
      });
    }

    return NextResponse.json({
      success: true,
      matched: true,
      source: "backend",
      numero_identificacion: payload.numero_identificacion,
      confidence: payload.confidence,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        matched: false,
        error: "No fue posible conectar con el backend biometrico configurado",
      },
      { status: 502 },
    );
  }
}
