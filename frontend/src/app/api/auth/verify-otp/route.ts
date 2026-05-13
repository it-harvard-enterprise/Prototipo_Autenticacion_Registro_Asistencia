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
      type?: string;
      token_hash?: string;
    };

    const backendPayload = await callBackend<BackendAuthResponse>(
      "/api/auth/verify-otp",
      {
        method: "POST",
        body: JSON.stringify({
          type: String(payload.type ?? "").trim(),
          token_hash: String(payload.token_hash ?? "").trim(),
        }),
      },
    );

    if (!backendPayload.success) {
      return NextResponse.json(
        {
          success: false,
          error: backendPayload.error ?? "No fue posible verificar el enlace",
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
