import { createClient } from "@supabase/supabase-js";

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
