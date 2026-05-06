import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nombre, apellido, role")
    .eq("id", user.id)
    .single();

  const displayName = profile
    ? `${profile.nombre} ${profile.apellido}`
    : user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
      : user.email;

  const roleLabel = profile?.role === "profesor" ? "profesor" : "estudiante";

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
