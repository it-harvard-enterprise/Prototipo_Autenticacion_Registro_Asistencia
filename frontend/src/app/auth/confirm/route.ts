import { type NextRequest, NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";

import { callBackend } from "@/lib/backend/server-api";
import { createClient } from "@/lib/supabase/server";

type BackendAuthResponse = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
};

function sanitizeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  return next;
}

function buildLoginErrorRedirect(
  origin: string,
  code: string,
  message: string,
): string {
  const params = new URLSearchParams({
    error: "access_denied",
    error_code: code,
    error_description: message,
  });

  return `${origin}/login#${params.toString()}`;
}

function resolveAppOrigin(
  request: NextRequest,
  fallbackOrigin: string,
): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host");
  const rawHost = (forwardedHost || host || "").split(",")[0]?.trim();
  if (!rawHost) {
    return fallbackOrigin;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const fallbackUrl = new URL(fallbackOrigin);
  const protocol = (
    forwardedProto || fallbackUrl.protocol.replace(":", "")
  ).trim();

  try {
    return new URL(`${protocol}://${rawHost}`).origin;
  } catch {
    return fallbackOrigin;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { origin: requestOrigin, searchParams } = new URL(request.url);
  const appOrigin = resolveAppOrigin(request, requestOrigin);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      buildLoginErrorRedirect(
        appOrigin,
        "otp_expired",
        "Email link is invalid or has expired",
      ),
    );
  }

  const requestedNext = searchParams.get("next");
  const fallbackNext = type === "recovery" ? "/reset-password" : "/";
  const nextPath = sanitizeNextPath(requestedNext ?? fallbackNext);

  let backendPayload: BackendAuthResponse;
  try {
    backendPayload = await callBackend<BackendAuthResponse>(
      "/api/auth/verify-otp",
      {
        method: "POST",
        body: JSON.stringify({
          type,
          token_hash: tokenHash,
        }),
      },
    );
  } catch (err) {
    return NextResponse.redirect(
      buildLoginErrorRedirect(
        appOrigin,
        "otp_expired",
        err instanceof Error
          ? err.message
          : "Email link is invalid or has expired",
      ),
    );
  }

  if (!backendPayload.success || !backendPayload.data) {
    return NextResponse.redirect(
      buildLoginErrorRedirect(
        appOrigin,
        "otp_expired",
        backendPayload.error || "Email link is invalid or has expired",
      ),
    );
  }

  const sessionCandidate =
    (backendPayload.data.session as Record<string, unknown> | undefined) ??
    backendPayload.data;
  const accessToken = String(sessionCandidate.access_token ?? "").trim();
  const refreshToken = String(sessionCandidate.refresh_token ?? "").trim();

  if (!accessToken || !refreshToken) {
    return NextResponse.redirect(
      buildLoginErrorRedirect(
        appOrigin,
        "otp_expired",
        "No se recibió una sesión válida para completar la verificación",
      ),
    );
  }

  const supabase = await createClient();
  const { error: setSessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (setSessionError) {
    return NextResponse.redirect(
      buildLoginErrorRedirect(
        appOrigin,
        "otp_expired",
        setSessionError.message || "Email link is invalid or has expired",
      ),
    );
  }

  const redirectUrl = new URL(nextPath, appOrigin);
  if (type === "invite") {
    redirectUrl.searchParams.set("invite", "1");
    const user =
      (sessionCandidate.user as Record<string, unknown> | undefined) ??
      (backendPayload.data.user as Record<string, unknown> | undefined);
    const invitedEmail = String(user?.email ?? "").trim();
    if (invitedEmail) {
      redirectUrl.searchParams.set("invited_email", invitedEmail);
    }
  }

  return NextResponse.redirect(redirectUrl);
}
