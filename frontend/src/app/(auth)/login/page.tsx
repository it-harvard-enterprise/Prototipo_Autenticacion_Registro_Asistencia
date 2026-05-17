"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const loginSchema = z.object({
  email: z.string().email("Ingrese un correo electrónico válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type AuthApiResponse = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
};

function getFriendlyLoginError(message: string): string {
  if (message === "Invalid login credentials") {
    return "Correo electrónico o contraseña incorrectos";
  }
  if (message === "Email not confirmed") {
    return "Correo electrónico no confirmado";
  }
  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true);
    setServerError(null);

    try {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
        }),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as AuthApiResponse | null;

      if (!response.ok || !payload?.success || !payload.data) {
        setServerError(
          getFriendlyLoginError(
            payload?.error ?? "No fue posible iniciar sesión",
          ),
        );
        setIsLoading(false);
        return;
      }

      const sessionCandidate =
        (payload.data.session as Record<string, unknown> | undefined) ??
        payload.data;

      const accessToken = String(sessionCandidate.access_token ?? "").trim();
      const refreshToken = String(sessionCandidate.refresh_token ?? "").trim();
      if (!accessToken || !refreshToken) {
        setServerError("No se recibió una sesión válida desde el backend");
        setIsLoading(false);
        return;
      }

      const supabase = createClient();
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (setSessionError) {
        setServerError(setSessionError.message);
        setIsLoading(false);
        return;
      }

      const user =
        (sessionCandidate.user as Record<string, unknown> | undefined) ??
        undefined;
      const metadata =
        (user?.user_metadata as Record<string, unknown> | undefined) ??
        undefined;

      if (metadata?.must_change_password === true) {
        router.push("/reset-password?forced=1");
        router.refresh();
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setServerError(
        err instanceof Error
          ? getFriendlyLoginError(err.message)
          : "No fue posible iniciar sesión",
      );
      setIsLoading(false);
      return;
    }
  }

  return (
    <Card className="shadow-md p-2">
      <CardHeader className="space-y-2 pt-6">
        <CardTitle className="text-3xl font-semibold">Iniciar Sesión</CardTitle>
        <CardDescription className="text-base">
          Ingrese sus credenciales para acceder al sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            method="post"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5"
          >
            {serverError && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700">{serverError}</p>
              </div>
            )}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">
                    Correo electrónico
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="correo@ejemplo.com"
                      autoComplete="email"
                      className="h-11 text-base"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Contraseña</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="h-11 text-base"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full h-11 text-base bg-[#b92f2d] hover:bg-[#982725] text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                "Iniciar sesión"
              )}
            </Button>

            <div className="text-center">
              <Link
                href="/recover-password"
                className="text-sm font-medium text-[#b92f2d] hover:text-[#982725] hover:underline"
              >
                ¿Olvidó su contraseña? Recupérela aquí.
              </Link>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
