import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveCurrentUserAccess } from "@/lib/auth/resolved-access";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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

  if (access.role === "administrador" && access.mustChangePassword) {
    redirect("/reset-password?forced=1");
  }

  if (access.role && access.approved) {
    redirect("/dashboard");
  }

  if (access.role === "administrador" && !access.approved) {
    redirect("/not-approved");
  }

  const displayName = access.fullName
    ? access.fullName
    : user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
      : user.email;

  const roleLabel = access.role ?? "usuario";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Bienvenido :D {roleLabel}</CardTitle>
          <CardDescription>{displayName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <p>
            Estamos validando su perfil para habilitar las funcionalidades del
            sistema de forma correcta.
          </p>
          <p>
            Si esta pantalla persiste, contacte al administrador del sistema.
          </p>
        </CardContent>
        <CardFooter>
          <form action={signOut} className="w-full">
            <Button type="submit" variant="outline" className="w-full">
              Cerrar sesión
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
