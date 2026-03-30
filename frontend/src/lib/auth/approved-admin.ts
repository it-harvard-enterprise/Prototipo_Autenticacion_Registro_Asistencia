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

  const { data: admin, error: adminError } = await supabase
    .from("administrador")
    .select("aprobado")
    .eq("id", user.id)
    .single();

  if (adminError || !admin) {
    return {
      ok: false,
      error: "No se encontró el registro del administrador.",
    };
  }

  if (!admin.aprobado) {
    return {
      ok: false,
      error: APPROVAL_REQUIRED_MESSAGE,
    };
  }

  return { ok: true };
}
