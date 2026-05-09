import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveCurrentUserAccess } from "@/lib/auth/resolved-access";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Bienvenido",
};

export default async function WelcomePage() {
  const access = await resolveCurrentUserAccess();
  const user = access.user;

  if (!user) {
    redirect("/login");
  }

  if (access.role === "administrador") {
    if (access.approved) {
      redirect("/dashboard");
    }
    redirect("/not-approved");
  }

  const displayName = access.fullName
    ? access.fullName
    : user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
      : user.email;

  const roleLabel = access.role === "profesor" ? "profesor" : "estudiante";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Bienvenido :D {roleLabel}</CardTitle>
          <CardDescription>{displayName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <p>
            Tu cuenta ya esta activa, pero por ahora las funciones del sistema
            estan disponibles solo para administradores.
          </p>
          <p>
            Si necesitas acceso a mas funciones, contacta al administrador del
            sistema.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
