"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getAdminById, updateAdmin } from "@/app/actions/admins";
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
});

type AdminFormValues = z.infer<typeof adminSchema>;

interface EditAdminPageProps {
  params: Promise<{ id: string }>;
}

export default function EditAdminPage({ params }: EditAdminPageProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [adminId, setAdminId] = useState<string | null>(null);

  const form = useForm<AdminFormValues>({
    resolver: zodResolver(adminSchema),
    defaultValues: {
      tipo_identificacion: "CC",
      numero_identificacion: "",
      nombres: "",
      apellidos: "",
      email: "",
    },
  });

  useEffect(() => {
    async function loadAdmin() {
      try {
        const { id } = await params;
        setAdminId(id);

        const result = await getAdminById(id);
        if (!result.success || !result.data) {
          setFetchError("No se encontró el administrador");
          setIsFetching(false);
          return;
        }

        const admin = result.data;
        form.reset({
          tipo_identificacion:
            admin.tipo_identificacion as AdminFormValues["tipo_identificacion"],
          numero_identificacion: admin.numero_identificacion,
          nombres: admin.nombres,
          apellidos: admin.apellidos,
          email: admin.email,
        });
        setIsFetching(false);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Error desconocido");
        setIsFetching(false);
      }
    }

    loadAdmin();
  }, [params, form]);

  async function onSubmit(values: AdminFormValues) {
    if (!adminId) return;

    setIsLoading(true);
    setServerError(null);

    const result = await updateAdmin(adminId, {
      tipo_identificacion: values.tipo_identificacion,
      numero_identificacion: values.numero_identificacion,
      nombres: values.nombres,
      apellidos: values.apellidos,
      email: values.email,
    });

    if (!result.success) {
      setServerError(
        result.error || "No fue posible actualizar el administrador",
      );
      setIsLoading(false);
      return;
    }

    toast.success("Administrador actualizado correctamente");
    router.push("/dashboard/admins");
  }

  if (isFetching) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gray-200 animate-pulse"></div>
          <div className="flex-1 space-y-2">
            <div className="h-8 bg-gray-200 rounded animate-pulse w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/dashboard/admins">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">{fetchError}</p>
        </div>
      </div>
    );
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
            Editar Administrador
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Actualice la información del administrador
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del Administrador</CardTitle>
          <CardDescription>
            Modifique los datos del administrador. El correo electrónico se usa
            para el acceso.
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
                    <FormItem className="md:col-span-2">
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
                      Actualizando...
                    </>
                  ) : (
                    "Guardar Cambios"
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
