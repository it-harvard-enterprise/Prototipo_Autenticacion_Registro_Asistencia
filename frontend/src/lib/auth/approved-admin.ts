import { createClient } from "@/lib/supabase/server";

export const APPROVAL_REQUIRED_MESSAGE =
  "Su usuario administrador no está aprobado para acceder a esta funcionalidad.";

export async function ensureApprovedAdmin(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      error: "Debe iniciar sesión para continuar.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, approved")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      ok: false,
      error: "No se encontró el perfil del usuario.",
    };
  }

  if (profile.role !== "administrador") {
    return {
      ok: false,
      error: "No tiene permisos de administrador.",
    };
  }

  if (!profile.approved) {
    return {
      ok: false,
      error: APPROVAL_REQUIRED_MESSAGE,
    };
  }

  return { ok: true };
}
