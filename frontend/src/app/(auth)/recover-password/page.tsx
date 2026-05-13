"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

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

const recoverSchema = z.object({
  email: z.string().email("Ingrese un correo electrónico válido"),
});

type RecoverFormValues = z.infer<typeof recoverSchema>;

type AuthApiResponse = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
};

export default function RecoverPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RecoverFormValues>({
    resolver: zodResolver(recoverSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: RecoverFormValues) {
    setIsLoading(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const redirectUrl = new URL("/auth/confirm", window.location.origin);
      redirectUrl.searchParams.set("next", "/reset-password");

      const response = await fetch("/api/auth/recover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: values.email,
          redirect_to: redirectUrl.toString(),
        }),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as AuthApiResponse | null;

      if (!response.ok || !payload?.success) {
        setServerError(
          payload?.error ?? "No fue posible enviar el enlace de recuperación",
        );
        setIsLoading(false);
        return;
      }

      setSuccessMessage(
        "Si el correo existe en el sistema, recibirás un enlace para restablecer tu contraseña.",
      );
      form.reset({ email: "" });
      setIsLoading(false);
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : "No fue posible enviar el enlace de recuperación",
      );
      setIsLoading(false);
    }
  }

  return (
    <Card className="shadow-md p-2">
      <CardHeader className="space-y-2 pt-6">
        <CardTitle className="text-3xl font-semibold">
          Recuperar contraseña
        </CardTitle>
        <CardDescription className="text-base">
          Escribe tu correo electrónico para enviarte un enlace de recuperación.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {successMessage ? (
          <div className="rounded-md bg-[#b92f2d]/10 border border-[#b92f2d]/30 p-5 text-center">
            <p className="text-base text-[#982725] font-medium">
              {successMessage}
            </p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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

              <Button
                type="submit"
                className="w-full h-11 text-base bg-[#b92f2d] hover:bg-[#982725] text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Enviando enlace...
                  </>
                ) : (
                  "Enviar enlace de recuperación"
                )}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-base text-gray-600">
          ¿Recordó su contraseña?{" "}
          <Link
            href="/login"
            className="font-medium text-gray-900 hover:underline"
          >
            Volver a iniciar sesión
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
