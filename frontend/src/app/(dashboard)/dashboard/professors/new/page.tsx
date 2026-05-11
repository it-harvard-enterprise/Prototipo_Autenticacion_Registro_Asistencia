"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  IDENTIFICATION_TYPE_OPTIONS,
  IDENTIFICATION_TYPE_VALUES,
} from "@/lib/identification-types";
import { COLOMBIA_EPS_OPTIONS, EPS_OTHER_OPTION } from "@/lib/student-options";
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

const professorSchema = z
  .object({
    tipo_identificacion: z.enum(IDENTIFICATION_TYPE_VALUES, {
      message: "Debe seleccionar un tipo de identificación",
    }),
    numero_identificacion: z
      .string()
      .min(4, "El número de identificación es requerido")
      .max(20),
    nombres: z.string().min(2, "Los nombres son requeridos").max(100),
    apellidos: z.string().min(2, "Los apellidos son requeridos").max(100),
    email: z.string().email("Ingrese un correo electrónico válido"),
    telefono: z.string().min(1, "El teléfono es requerido").max(20),
    direccion: z.string().min(1, "La dirección es requerida").max(200),
    barrio: z.string().min(1, "El barrio es requerido").max(100),
    nombre_contacto_emergencia: z
      .string()
      .min(1, "El nombre del contacto de emergencia es requerido")
      .max(200),
    telefono_contacto_emergencia: z
      .string()
      .min(1, "El teléfono del contacto de emergencia es requerido")
      .max(20),
    eps_select: z.string().min(1, "Debe seleccionar una EPS"),
    eps_otra: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.eps_select === EPS_OTHER_OPTION &&
      (!data.eps_otra || data.eps_otra.trim().length < 2)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eps_otra"],
        message: "Debe escribir la EPS cuando selecciona 'Otro'",
      });
    }
  });

type ProfessorFormValues = z.input<typeof professorSchema>;

export default function NewProfessorPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ProfessorFormValues>({
    resolver: zodResolver(professorSchema),
    defaultValues: {
      tipo_identificacion: "CC",
      numero_identificacion: "",
      nombres: "",
      apellidos: "",
      email: "",
      telefono: "",
      direccion: "",
      barrio: "",
      nombre_contacto_emergencia: "",
      telefono_contacto_emergencia: "",
      eps_select: "NUEVA EPS",
      eps_otra: "",
    },
  });

  async function onSubmit(values: ProfessorFormValues) {
    const epsValue =
      values.eps_select === EPS_OTHER_OPTION
        ? (values.eps_otra ?? "").trim()
        : values.eps_select;

    if (!epsValue) {
      toast.error("Debe seleccionar o escribir la EPS");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/professors/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo_identificacion: values.tipo_identificacion,
          numero_identificacion: values.numero_identificacion,
          nombres: values.nombres,
          apellidos: values.apellidos,
          email: values.email,
          telefono: values.telefono,
          direccion: values.direccion,
          barrio: values.barrio,
          nombre_contacto_emergencia: values.nombre_contacto_emergencia,
          telefono_contacto_emergencia: values.telefono_contacto_emergencia,
          eps: epsValue,
        }),
      });

      const result = await res.json().catch(() => ({ success: false }));
      if (!res.ok || !result.success) {
        toast.error(result.error ?? "Error al crear el profesor");
        return;
      }

      toast.success("Profesor creado correctamente");
      router.replace("/dashboard/professors");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error desconocido al crear",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/professors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Profesor</h1>
          <p className="text-gray-500 mt-1">
            Registre profesores para enviarles la invitación de acceso.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registro de profesor</CardTitle>
          <CardDescription>
            Complete la información básica del profesor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tipo_identificacion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de identificación *</FormLabel>
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
                      <FormLabel>Número de identificación *</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                      <FormLabel>Nombres *</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                      <FormLabel>Apellidos *</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                      <FormLabel>Correo electrónico *</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="telefono"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="direccion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="barrio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barrio *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nombre_contacto_emergencia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contacto de emergencia *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="telefono_contacto_emergencia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono emergencia *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="eps_select"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>EPS *</FormLabel>
                      <FormControl>
                        <select
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
                        >
                          {COLOMBIA_EPS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                          <option value={EPS_OTHER_OPTION}>OTRO</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("eps_select") === EPS_OTHER_OPTION && (
                  <FormField
                    control={form.control}
                    name="eps_otra"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>EPS (otro)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="bg-[#b92f2d] hover:bg-[#982725] text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Profesor"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
