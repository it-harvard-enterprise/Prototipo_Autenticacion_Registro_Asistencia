import { createClient } from "@supabase/supabase-js";

export type ManagedUserRole = "estudiante" | "profesor";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function inviteUserByEmail(email: string, redirectTo: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (error) {
    const message = error.message ?? "Error sending invite";
    const isAlreadyRegistered = /already\s+(registered|exists)/i.test(message);
    return {
      ok: false,
      error: message,
      alreadyRegistered: isAlreadyRegistered,
      data,
    };
  }

  return { ok: true, data };
}

function isAlreadyRegisteredError(message: string): boolean {
  return /already\s+(registered|exists|been\s+registered)/i.test(message);
}

export async function createManagedAuthUser(params: {
  email: string;
  password: string;
  role: ManagedUserRole;
  nombres: string;
  apellidos: string;
  tipoIdentificacion: string;
  numeroIdentificacion: string;
  approvedByAdmin: boolean;
}): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string; alreadyRegistered?: boolean }
> {
  const supabase = createAdminClient();
  const email = params.email.trim().toLowerCase();
  const password = params.password.trim();

  if (!email) {
    return { ok: false, error: "El correo electrónico es obligatorio." };
  }

  if (!password) {
    return { ok: false, error: "La contraseña inicial es obligatoria." };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      rol: params.role,
      role: params.role,
      nombres: params.nombres,
      apellidos: params.apellidos,
      tipo_identificacion: params.tipoIdentificacion,
      numero_identificacion: params.numeroIdentificacion,
      must_change_password: true,
      approved_by_admin: params.approvedByAdmin,
    },
  });

  if (error || !data.user?.id) {
    const message = error?.message ?? "No se pudo crear el usuario en auth.";
    return {
      ok: false,
      error: message,
      alreadyRegistered: isAlreadyRegisteredError(message),
    };
  }

  return { ok: true, userId: data.user.id };
}

export async function deleteAuthUserById(userId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = createAdminClient();

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    return {
      ok: false,
      error: error.message ?? "No se pudo eliminar el usuario auth.",
    };
  }

  return { ok: true };
}
