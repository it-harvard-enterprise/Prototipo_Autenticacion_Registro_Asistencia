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
      metadata?: Record<string, unknown>;
      email_redirect_to?: string;
    };

    const emailRedirectTo = String(payload.email_redirect_to ?? "").trim();

    const backendPayload = await callBackend<BackendAuthResponse>(
      "/api/auth/sign-up",
      {
        method: "POST",
        body: JSON.stringify({
          email: String(payload.email ?? "")
            .trim()
            .toLowerCase(),
          password: String(payload.password ?? ""),
          metadata: payload.metadata ?? {},
          email_redirect_to: emailRedirectTo || undefined,
        }),
      },
    );

    if (!backendPayload.success) {
      return NextResponse.json(
        {
          success: false,
          error: backendPayload.error ?? "No fue posible registrar la cuenta",
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
