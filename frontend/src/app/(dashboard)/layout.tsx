import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardLayoutClient } from "./layout-client";
import { resolveCurrentUserAccess } from "@/lib/auth/resolved-access";

export const metadata: Metadata = {
  title: "SysAsistencia - Dashboard",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await resolveCurrentUserAccess();
  const user = access.user;

  if (!user) {
    redirect("/login");
  }

  const userName = access.fullName
    ? access.fullName
    : user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
      : undefined;

  const userEmail = user.email;

  if (access.mustChangePassword) {
    redirect("/reset-password?forced=1");
  }

  if (access.role !== "administrador") {
    redirect("/welcome");
  }

  if (!access.approved) {
    redirect("/not-approved");
  }

  return (
    <DashboardLayoutClient userName={userName} userEmail={userEmail}>
      {children}
    </DashboardLayoutClient>
  );
}
