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
      password?: string;
    };

    const backendPayload = await callBackend<BackendAuthResponse>(
      "/api/auth/sign-in",
      {
        method: "POST",
        body: JSON.stringify({
          email: String(payload.email ?? "")
            .trim()
            .toLowerCase(),
          password: String(payload.password ?? ""),
        }),
      },
    );

    if (!backendPayload.success) {
      return NextResponse.json(
        {
          success: false,
          error: backendPayload.error ?? "No fue posible iniciar sesión",
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
