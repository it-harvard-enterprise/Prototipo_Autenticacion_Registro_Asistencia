import { createClient } from "@/lib/supabase/server";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("nombre, apellido, role, approved")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    return {
      user,
      role: profile.role,
      approved: Boolean(profile.approved),
      mustChangePassword,
      fullName: `${profile.nombre} ${profile.apellido}`.trim(),
      profileFound: true,
    };
  }

  const { data: admin } = await supabase
    .from("administrador")
    .select("nombres, apellidos")
    .eq("id", user.id)
    .maybeSingle();

  if (admin) {
    return {
      user,
      role: "administrador",
      approved: false,
      mustChangePassword,
      fullName: `${admin.nombres} ${admin.apellidos}`.trim(),
      profileFound: false,
    };
  }

  return {
    user,
    role: null,
    approved: false,
    mustChangePassword,
    profileFound: false,
  };
}
