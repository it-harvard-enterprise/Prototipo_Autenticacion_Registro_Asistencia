"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { Alert, AlertDescription } from "@/components/ui/alert";

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

type AuthApiResponse = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
};

function AcceptInvitationInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitedEmail = searchParams.get("invited_email")?.trim() ?? "";
  const isInviteFlow = searchParams.get("invite") === "1";
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isInviteContextValid, setIsInviteContextValid] = useState(true);
  const [success, setSuccess] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userMetadata, setUserMetadata] = useState<Record<string, unknown>>({});

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      setIsInviteContextValid(false);
      setError(
        "No fue posible validar la sesión de invitación. Abre nuevamente el enlace recibido por correo.",
      );
    }, 10000);

    const getSessionUser = async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) {
          return;
        }

        const currentAccessToken = session?.access_token?.trim() ?? "";
        if (!currentAccessToken) {
          setIsInviteContextValid(false);
          setUserEmail(null);
          setError(
            "Sesión no válida. Por favor intenta con el enlace de la invitación nuevamente.",
          );
          return;
        }

        const response = await fetch("/api/auth/session-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ access_token: currentAccessToken }),
        });

        const payload = (await response
          .json()
          .catch(() => null)) as AuthApiResponse | null;
        if (!response.ok || !payload?.success || !payload.data) {
          setIsInviteContextValid(false);
          setUserEmail(null);
          setError(
            payload?.error || "No fue posible validar la sesión de invitación.",
          );
          return;
        }

        const activeEmail = String(payload.data.email ?? "").trim();
        const metadata =
          (payload.data.user_metadata as Record<string, unknown> | undefined) ??
          {};

        if (
          isInviteFlow &&
          invitedEmail &&
          activeEmail &&
          activeEmail.toLowerCase() !== invitedEmail.toLowerCase()
        ) {
          setIsInviteContextValid(false);
          setUserEmail(null);
          setError(
            "La sesión activa no corresponde a esta invitación. Cerramos la sesión por seguridad; abre de nuevo el enlace de invitación.",
          );

          await fetch("/api/auth/sign-out", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ access_token: currentAccessToken }),
          }).catch(() => undefined);
          await supabase.auth.signOut().catch(() => undefined);
          return;
        }

        setAccessToken(currentAccessToken);
        setUserMetadata(metadata);
        setIsInviteContextValid(true);
        setUserEmail(activeEmail || invitedEmail || null);
      } catch (unexpectedError) {
        if (cancelled) {
          return;
        }

        setIsInviteContextValid(false);
        setError(
          unexpectedError instanceof Error
            ? unexpectedError.message
            : "Error inesperado al validar la sesión de invitación.",
        );
      } finally {
        if (!cancelled) {
          window.clearTimeout(timeoutId);
        }
      }
    };

    getSessionUser();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [invitedEmail, isInviteFlow]);

  async function onSubmit(values: PasswordFormValues) {
    if (!isInviteContextValid) {
      setError(
        "No se pudo validar la sesión de invitación. Abre nuevamente el enlace recibido por correo.",
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const currentAccessToken = accessToken?.trim() ?? "";
      if (!currentAccessToken) {
        setIsInviteContextValid(false);
        setUserEmail(null);
        setError(
          "No se pudo validar la sesión de invitación. Abre nuevamente el enlace recibido por correo.",
        );
        setIsLoading(false);
        return;
      }

      const sessionUserResponse = await fetch("/api/auth/session-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ access_token: currentAccessToken }),
      });
      const sessionUserPayload = (await sessionUserResponse
        .json()
        .catch(() => null)) as AuthApiResponse | null;
      if (
        !sessionUserResponse.ok ||
        !sessionUserPayload?.success ||
        !sessionUserPayload.data
      ) {
        setIsInviteContextValid(false);
        setUserEmail(null);
        setError(
          sessionUserPayload?.error ||
            "No se pudo validar la sesión de invitación. Abre nuevamente el enlace recibido por correo.",
        );
        setIsLoading(false);
        return;
      }

      const metadata =
        (sessionUserPayload.data.user_metadata as
          | Record<string, unknown>
          | undefined) ?? userMetadata;

      const activeEmail = String(sessionUserPayload.data.email ?? "").trim();
      if (
        isInviteFlow &&
        invitedEmail &&
        activeEmail &&
        activeEmail.toLowerCase() !== invitedEmail.toLowerCase()
      ) {
        setIsInviteContextValid(false);
        setUserEmail(null);
        setError(
          "El usuario autenticado no coincide con la invitación. Por seguridad no se puede cambiar la contraseña.",
        );
        const supabase = createClient();
        await fetch("/api/auth/sign-out", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ access_token: currentAccessToken }),
        }).catch(() => undefined);
        await supabase.auth.signOut().catch(() => undefined);
        setIsLoading(false);
        return;
      }

      setUserEmail(activeEmail || invitedEmail || null);

      const updateResponse = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_token: currentAccessToken,
          password: values.password,
          data: {
            ...metadata,
            must_change_password: false,
          },
        }),
      });
      const updatePayload = (await updateResponse
        .json()
        .catch(() => null)) as AuthApiResponse | null;

      if (!updateResponse.ok || !updatePayload?.success) {
        setError(updatePayload?.error || "Error al actualizar la contraseña");
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      toast.success("Contraseña configurada exitosamente");

      // Redirect to login or dashboard after a short delay
      setTimeout(() => {
        const supabase = createClient();
        void fetch("/api/auth/sign-out", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ access_token: currentAccessToken }),
        }).catch(() => undefined);
        void supabase.auth.signOut().catch(() => undefined);
        router.push("/login");
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error desconocido al actualizar la contraseña",
      );
      setIsLoading(false);
    }
  }

  if (error && !userEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">
              Error de sesión
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/")}
            >
              Volver al inicio
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-green-600 flex items-center justify-center gap-2">
              <CheckCircle2 className="h-6 w-6" />
              ¡Éxito!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-slate-600 mb-2">
                Tu contraseña ha sido configurada exitosamente.
              </p>
              <p className="text-sm font-semibold text-slate-900">
                Usuario: {userEmail}
              </p>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Serás redirigido a la página de inicio de sesión en unos
                momentos...
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Configurar contraseña</CardTitle>
          <CardDescription>
            Bienvenido a la plataforma de registro de asistencia. Por favor,
            configura tu contraseña para acceder a tu cuenta.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-slate-600 mb-1">
              Tu nombre de usuario será:
            </p>
            <p className="text-sm font-semibold text-slate-900 break-all">
              {userEmail || invitedEmail || "Cargando..."}
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Ingresa tu contraseña"
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Mínimo 8 caracteres. Debe incluir mayúsculas, minúsculas y
                      números.
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
                    <FormLabel>Confirmar contraseña</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Confirma tu contraseña"
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !isInviteContextValid}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? "Configurando..." : "Configurar contraseña"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense>
      <AcceptInvitationInner />
    </Suspense>
  );
}
