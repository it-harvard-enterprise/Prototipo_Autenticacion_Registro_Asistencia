import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardLayoutClient } from "./layout-client";

export const metadata: Metadata = {
  title: "SysAsistencia - Dashboard",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nombre, apellido, role, approved")
    .eq("id", user.id)
    .single();

  const userName = profile
    ? `${profile.nombre} ${profile.apellido}`
    : user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
      : undefined;

  const userEmail = user.email;

  if (profile?.role !== "administrador") {
    redirect("/welcome");
  }

  if (!profile?.approved) {
    redirect("/not-approved");
  }

  return (
    <DashboardLayoutClient userName={userName} userEmail={userEmail}>
      {children}
    </DashboardLayoutClient>
  );
}
