"use server";

import { redirect } from "next/navigation";
import { callBackend } from "@/lib/backend/server-api";
import { createClient } from "@/lib/supabase/server";

type BackendAuthResponse = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
};

type SessionTokens = {
  accessToken: string;
  refreshToken: string;
};

function extractSessionTokens(
  data: Record<string, unknown> | undefined,
): SessionTokens | null {
  if (!data) {
    return null;
  }

  const sessionCandidate =
    (data.session as Record<string, unknown> | undefined) ?? data;
  const accessToken = String(sessionCandidate.access_token ?? "").trim();
  const refreshToken = String(sessionCandidate.refresh_token ?? "").trim();

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
}

export async function signIn(email: string, password: string) {
  try {
    const backendPayload = await callBackend<BackendAuthResponse>(
      "/api/auth/sign-in",
      {
        method: "POST",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      },
    );

    if (!backendPayload.success) {
      return {
        success: false,
        error: backendPayload.error ?? "No fue posible iniciar sesión",
      };
    }

    const supabase = await createClient();
    const tokens = extractSessionTokens(backendPayload.data);
    if (tokens) {
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      if (setSessionError) {
        return { success: false, error: setSessionError.message };
      }
    }

    return { success: true, data: backendPayload.data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}

export async function signUp(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  tipoIdentificacion?: string,
  numeroIdentificacion?: string,
) {
  const supabase = await createClient();
  const frontendOrigin =
    process.env.FRONTEND_ORIGIN?.split(",")[0]?.trim() ||
    "http://localhost:3000";
  const emailRedirectTo = new URL("/login", frontendOrigin).toString();

  try {
    const backendPayload = await callBackend<BackendAuthResponse>(
      "/api/auth/sign-up",
      {
        method: "POST",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          email_redirect_to: emailRedirectTo,
          metadata: {
            rol: "administrador",
            role: "administrador",
            tipo_identificacion: tipoIdentificacion ?? "CC",
            numero_identificacion: numeroIdentificacion ?? "12345",
            nombres: firstName,
            apellidos: lastName,
            first_name: firstName,
            last_name: lastName,
          },
        }),
      },
    );

    if (!backendPayload.success) {
      return {
        success: false,
        error: backendPayload.error ?? "No fue posible registrar la cuenta",
      };
    }

    const supabase = await createClient();
    const tokens = extractSessionTokens(backendPayload.data);
    if (tokens) {
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      if (setSessionError) {
        return { success: false, error: setSessionError.message };
      }
    }

    const user =
      (backendPayload.data?.user as Record<string, unknown> | undefined) ??
      undefined;

    return { success: true, user };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}

export async function signOut() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token?.trim();
  if (accessToken) {
    try {
      await callBackend<BackendAuthResponse>("/api/auth/sign-out", {
        method: "POST",
        body: JSON.stringify({ access_token: accessToken }),
      });
    } catch {
      // Continue local signout even if remote session revoke fails.
    }
  }

  await supabase.auth.signOut();
  redirect("/login");
}
