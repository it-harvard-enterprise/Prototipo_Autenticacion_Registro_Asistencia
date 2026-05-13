import { createClient } from "@/lib/supabase/server";
import { callBackend } from "@/lib/backend/server-api";

export type ResolvedRole = "administrador" | "estudiante" | "profesor";

export interface ResolvedAccess {
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  } | null;
  role: ResolvedRole | null;
  approved: boolean;
  mustChangePassword: boolean;
  fullName?: string;
  profileFound: boolean;
}

type ResolveAccessBackendData = {
  role?: string | null;
  approved?: boolean;
  mustChangePassword?: boolean;
  fullName?: string | null;
  profileFound?: boolean;
};

type ResolveAccessBackendResponse = {
  success: boolean;
  data?: ResolveAccessBackendData;
  error?: string;
};

function asResolvedRole(value: unknown): ResolvedRole | null {
  if (
    value === "administrador" ||
    value === "estudiante" ||
    value === "profesor"
  ) {
    return value;
  }
  return null;
}

export async function resolveCurrentUserAccess(): Promise<ResolvedAccess> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      user: null,
      role: null,
      approved: false,
      mustChangePassword: false,
      profileFound: false,
    };
  }

  const mustChangePassword = Boolean(user.user_metadata?.must_change_password);

  try {
    const payload = await callBackend<ResolveAccessBackendResponse>(
      "/api/auth/resolve-access",
      {
        method: "POST",
        body: JSON.stringify({
          user_id: user.id,
          email: user.email ?? "",
          user_metadata: user.user_metadata ?? {},
        }),
      },
    );

    if (!payload.success || !payload.data) {
      return {
        user,
        role: null,
        approved: false,
        mustChangePassword,
        profileFound: false,
      };
    }

    const resolvedRole = asResolvedRole(payload.data.role);
    return {
      user,
      role: resolvedRole,
      approved: Boolean(payload.data.approved),
      mustChangePassword: Boolean(
        payload.data.mustChangePassword ?? mustChangePassword,
      ),
      fullName:
        typeof payload.data.fullName === "string"
          ? payload.data.fullName.trim()
          : undefined,
      profileFound: Boolean(payload.data.profileFound),
    };
  } catch {
    return {
      user,
      role: null,
      approved: false,
      mustChangePassword,
      profileFound: false,
    };
  }
}
