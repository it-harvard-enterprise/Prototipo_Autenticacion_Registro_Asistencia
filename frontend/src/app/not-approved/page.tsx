import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Cuenta no aprobada",
};

export default async function NotApprovedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: admin } = await supabase
    .from("administrador")
    .select("aprobado")
    .eq("id", user.id)
    .single();

  if (admin?.aprobado) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Cuenta no aprobada</CardTitle>
          <CardDescription>
            Tu cuenta de administrador está pendiente de aprobación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-700">
            Aún no puedes acceder al dashboard ni ejecutar acciones del sistema.
            Contacta al administrador principal para habilitar tu cuenta.
          </p>
          <div className="flex gap-2">
            <form action={signOut}>
              <Button
                type="submit"
                className="bg-[#b92f2d] hover:bg-[#982725] text-white"
              >
                Volver a iniciar sesión
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
