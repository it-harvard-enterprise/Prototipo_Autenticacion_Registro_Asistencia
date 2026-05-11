"use client";

import { useEffect, useState } from "react";
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
  FormDescription,
} from "@/components/ui/form";

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .regex(/[A-Z]/, "La contraseña debe incluir al menos una mayúscula")
      .regex(/[a-z]/, "La contraseña debe incluir al menos una minúscula")
      .regex(/[0-9]/, "La contraseña debe incluir al menos un número"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    let cancelled = false;

    const verifyRecoverySession = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (cancelled) {
          return;
        }

        if (error || !user) {
          setServerError(
            "El enlace de recuperación es inválido o expiró. Solicite uno nuevo.",
          );
          setIsCheckingSession(false);
          return;
        }

        setUserEmail(user.email ?? null);
        setIsCheckingSession(false);
      } catch (err) {
        if (cancelled) {
          return;
        }

        setServerError(
          err instanceof Error
            ? err.message
            : "No fue posible validar la sesión de recuperación",
        );
        setIsCheckingSession(false);
      }
    };

    verifyRecoverySession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(values: PasswordFormValues) {
    setIsLoading(true);
    setServerError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const existingMetadata =
        (user?.user_metadata as Record<string, unknown> | undefined) ?? {};
      const { error } = await supabase.auth.updateUser({
        password: values.password,
        data: {
          ...existingMetadata,
          must_change_password: false,
        },
      });

      if (error) {
        setServerError(error.message || "No se pudo actualizar la contraseña");
        setIsLoading(false);
        return;
      }

      setSuccessMessage("Contraseña actualizada correctamente.");
      setIsLoading(false);

      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1500);
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la contraseña",
      );
      setIsLoading(false);
    }
  }

  if (isCheckingSession) {
    return (
      <Card className="shadow-md p-2">
        <CardContent className="py-10 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#b92f2d]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md p-2">
      <CardHeader className="space-y-2 pt-6">
        <CardTitle className="text-3xl font-semibold">
          Nueva contraseña
        </CardTitle>
        <CardDescription className="text-base">
          Define tu nueva contraseña para recuperar el acceso a tu cuenta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {serverError && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 mb-5">
            <p className="text-sm text-red-700">{serverError}</p>
          </div>
        )}

        {successMessage ? (
          <div className="rounded-md bg-[#b92f2d]/10 border border-[#b92f2d]/30 p-5 text-center">
            <p className="text-base text-[#982725] font-medium">
              {successMessage}
            </p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
                <p className="text-xs text-gray-500">Cuenta</p>
                <p className="text-sm font-medium text-gray-800 break-all">
                  {userEmail ?? "No identificada"}
                </p>
              </div>

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">
                      Nueva contraseña
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="h-11 text-base"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Mínimo 8 caracteres. Incluya mayúscula, minúscula y
                      número.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">
                      Confirmar contraseña
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
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
                    Actualizando...
                  </>
                ) : (
                  "Actualizar contraseña"
                )}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-base text-gray-600">
          ¿Desea volver?{" "}
          <Link
            href="/login"
            className="font-medium text-gray-900 hover:underline"
          >
            Ir a iniciar sesión
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
