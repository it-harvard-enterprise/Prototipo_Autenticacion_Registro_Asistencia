"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createAdmin } from "@/app/actions/admins";
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

const adminSchema = z.object({
  tipo_identificacion: z.enum(IDENTIFICATION_TYPE_VALUES, {
    message: "Debe seleccionar un tipo de identificación",
  }),
  numero_identificacion: z
    .string()
    .min(4, "El número de identificación es requerido")
    .max(20, "El número de identificación es demasiado largo"),
  nombres: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(50, "El nombre es demasiado largo"),
  apellidos: z
    .string()
    .min(2, "El apellido debe tener al menos 2 caracteres")
    .max(50, "El apellido es demasiado largo"),
  email: z.string().email("Ingrese un correo electrónico válido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(/[A-Z]/, "La contraseña debe incluir al menos una mayúscula")
    .regex(/[a-z]/, "La contraseña debe incluir al menos una minúscula")
    .regex(/[0-9]/, "La contraseña debe incluir al menos un número"),
});

type AdminFormValues = z.infer<typeof adminSchema>;

export default function CreateAdminPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<AdminFormValues>({
    resolver: zodResolver(adminSchema),
    defaultValues: {
      tipo_identificacion: "CC",
      numero_identificacion: "",
      nombres: "",
      apellidos: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: AdminFormValues) {
    setIsLoading(true);
    setServerError(null);

    const result = await createAdmin({
      tipo_identificacion: values.tipo_identificacion,
      numero_identificacion: values.numero_identificacion,
      nombres: values.nombres,
      apellidos: values.apellidos,
      email: values.email,
      password: values.password,
    });

    if (!result.success) {
      setServerError(result.error || "No fue posible crear el administrador");
      setIsLoading(false);
      return;
    }

    toast.success("Administrador creado correctamente");
    router.push("/dashboard/admins");
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/admins">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Crear Administrador
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Complete el formulario para registrar un nuevo administrador
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del Administrador</CardTitle>
          <CardDescription>
            Ingrese los datos del nuevo administrador. Se usará el correo
            electrónico y la contraseña especificada para el acceso inicial.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                          className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
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
                          className="h-10"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nombres"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Juan" className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="apellidos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Apellido</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Pérez"
                          className="h-10"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">
                        Correo Electrónico
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="admin@ejemplo.com"
                          className="h-10"
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
                          className="h-10"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-gray-500 mt-1">
                        Mínimo 8 caracteres, incluya mayúscula, minúscula y
                        número
                      </p>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex gap-3 justify-end pt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-[#b92f2d] hover:bg-[#982725] text-white"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    "Crear Administrador"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
