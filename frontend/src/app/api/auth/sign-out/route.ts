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
      access_token?: string;
    };

    const backendPayload = await callBackend<BackendAuthResponse>(
      "/api/auth/sign-out",
      {
        method: "POST",
        body: JSON.stringify({
          access_token: String(payload.access_token ?? "").trim(),
        }),
      },
    );

    if (!backendPayload.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            backendPayload.error ?? "No fue posible cerrar la sesión remota",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(backendPayload, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
