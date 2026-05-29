import {
  resolveCurrentUserAccess,
  type ResolvedRole,
  type ResolvedAccess,
} from "@/lib/auth/resolved-access";

export const APPROVAL_REQUIRED_MESSAGE =
  "Su usuario administrador no está aprobado para acceder a esta funcionalidad.";

export async function ensureApprovedRoles(
  allowedRoles: ResolvedRole[],
  unauthorizedMessage = "No tiene permisos para esta funcionalidad.",
): Promise<{
  ok: boolean;
  error?: string;
  access?: ResolvedAccess;
}> {
  const access = await resolveCurrentUserAccess();

  if (!access.user) {
    return {
      ok: false,
      error: "Debe iniciar sesión para continuar.",
    };
  }

  if (!access.role || !allowedRoles.includes(access.role)) {
    return {
      ok: false,
      error: unauthorizedMessage,
    };
  }

  if (!access.approved) {
    return {
      ok: false,
      error: "Su usuario no está aprobado para acceder a esta funcionalidad.",
    };
  }

  return { ok: true, access };
}

export async function ensureApprovedAdmin(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const approval = await ensureApprovedRoles(
    ["administrador"],
    "No tiene permisos de administrador.",
  );
  if (!approval.ok) {
    return {
      ok: false,
      error:
        approval.error ===
        "Su usuario no está aprobado para acceder a esta funcionalidad."
          ? APPROVAL_REQUIRED_MESSAGE
          : approval.error,
    };
  }

  return { ok: true };
}
