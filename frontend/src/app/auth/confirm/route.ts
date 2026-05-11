import { type NextRequest, NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

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
  const nextPath = sanitizeNextPath(searchParams.get("next"));

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      buildLoginErrorRedirect(
        appOrigin,
        "otp_expired",
        "Email link is invalid or has expired",
      ),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(
      buildLoginErrorRedirect(
        appOrigin,
        error.code ?? "otp_expired",
        error.message || "Email link is invalid or has expired",
      ),
    );
  }

  const redirectUrl = new URL(nextPath, appOrigin);
  redirectUrl.searchParams.set("invite", "1");
  if (data.user?.email) {
    redirectUrl.searchParams.set("invited_email", data.user.email);
  }

  return NextResponse.redirect(redirectUrl);
}
