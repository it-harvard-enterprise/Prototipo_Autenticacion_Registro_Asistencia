import { resolveCurrentUserAccess } from "@/lib/auth/resolved-access";

export const APPROVAL_REQUIRED_MESSAGE =
  "Su usuario administrador no está aprobado para acceder a esta funcionalidad.";

export async function ensureApprovedAdmin(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const access = await resolveCurrentUserAccess();

  if (!access.user) {
    return {
      ok: false,
      error: "Debe iniciar sesión para continuar.",
    };
  }

  if (access.role !== "administrador") {
    return {
      ok: false,
      error: "No tiene permisos de administrador.",
    };
  }

  if (!access.approved) {
    return {
      ok: false,
      error: APPROVAL_REQUIRED_MESSAGE,
    };
  }

  return { ok: true };
}
