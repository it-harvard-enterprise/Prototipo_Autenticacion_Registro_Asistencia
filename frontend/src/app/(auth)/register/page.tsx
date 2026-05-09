"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  IDENTIFICATION_TYPE_OPTIONS,
  IDENTIFICATION_TYPE_VALUES,
} from "@/lib/identification-types";
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

const registerSchema = z.object({
  tipo_identificacion: z.enum(IDENTIFICATION_TYPE_VALUES, {
    message: "Debe seleccionar un tipo de identificación",
  }),
  numero_identificacion: z
    .string()
    .min(4, "El número de identificación es requerido")
    .max(20, "El número de identificación es demasiado largo"),
  firstName: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(50, "El nombre es demasiado largo"),
  lastName: z
    .string()
    .min(2, "El apellido debe tener al menos 2 caracteres")
    .max(50, "El apellido es demasiado largo"),
  email: z.string().email("Ingrese un correo electrónico válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      tipo_identificacion: "CC",
      numero_identificacion: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    setIsLoading(true);
    setServerError(null);
    setSuccessMessage(null);

    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          nombres: values.firstName,
          apellidos: values.lastName,
          first_name: values.firstName,
          last_name: values.lastName,
        },
      },
    });

    if (error) {
      setServerError(error.message);
      setIsLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from("administrador").upsert({
        id: data.user.id,
        tipo_identificacion: values.tipo_identificacion,
        numero_identificacion: values.numero_identificacion,
        nombres: values.firstName,
        apellidos: values.lastName,
        email: values.email,
        aprobado: false,
      });

      // If user is immediately logged in (email confirmation disabled)
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      setSuccessMessage(
        "Revise su correo electrónico para confirmar su cuenta antes de iniciar sesión.",
      );
    }

    setIsLoading(false);
  }

  return (
    <Card className="shadow-md p-2">
      <CardHeader className="space-y-2 pt-6">
        <CardTitle className="text-3xl font-semibold">Crear cuenta</CardTitle>
        <CardDescription className="text-base">
          Complete el formulario para registrarse en el sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        {successMessage ? (
          <div className="rounded-md bg-[#b92f2d]/10 border border-[#b92f2d]/30 p-5 text-center">
            <p className="text-base text-[#982725] font-medium">
              {successMessage}
            </p>
            <Link
              href="/login"
              className="mt-3 inline-block text-base text-[#b92f2d] font-semibold hover:text-[#982725] hover:underline"
            >
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {serverError && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-700">{serverError}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField
                  control={form.control}
                  name="tipo_identificacion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">
                        Tipo de identificación
                      </FormLabel>
                      <FormControl>
                        <select
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
                        >
                          {IDENTIFICATION_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="numero_identificacion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">
                        Número de identificación
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123456789"
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
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Nombre</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Juan"
                          autoComplete="given-name"
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
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Apellido</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Pérez"
                          autoComplete="family-name"
                          className="h-11 text-base"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                    Creando cuenta...
                  </>
                ) : (
                  "Crear cuenta"
                )}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-base text-gray-600">
          ¿Ya tiene cuenta?{" "}
          <Link
            href="/login"
            className="font-medium text-gray-900 hover:underline"
          >
            Iniciar sesión
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
