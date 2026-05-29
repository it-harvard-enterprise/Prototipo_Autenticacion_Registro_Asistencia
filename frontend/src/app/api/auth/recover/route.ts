import { NextResponse } from "next/server";

import { callBackend } from "@/lib/backend/server-api";

type BackendAuthResponse = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
};

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as {
      email?: string;
      redirect_to?: string;
    };

    const redirectTo = String(payload.redirect_to ?? "").trim();

    const backendPayload = await callBackend<BackendAuthResponse>(
      "/api/auth/recover",
      {
        method: "POST",
        body: JSON.stringify({
          email: String(payload.email ?? "")
            .trim()
            .toLowerCase(),
          redirect_to: redirectTo || undefined,
        }),
      },
    );

    if (!backendPayload.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            backendPayload.error ??
            "No fue posible solicitar la recuperación de contraseña",
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
