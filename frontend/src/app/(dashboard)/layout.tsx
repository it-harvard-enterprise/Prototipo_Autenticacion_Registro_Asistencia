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

  const { data: admin } = await supabase
    .from("administrador")
    .select("nombres, apellidos, aprobado")
    .eq("id", user.id)
    .single();

  const userName = admin
    ? `${admin.nombres} ${admin.apellidos}`
    : user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
      : undefined;

  const userEmail = user.email;

  if (!admin?.aprobado) {
    redirect("/not-approved");
  }

  return (
    <DashboardLayoutClient userName={userName} userEmail={userEmail}>
      {children}
    </DashboardLayoutClient>
  );
}
