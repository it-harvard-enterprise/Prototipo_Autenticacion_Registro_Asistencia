"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getProfessorById } from "@/app/actions/professors";
import {
  IDENTIFICATION_TYPE_OPTIONS,
  IDENTIFICATION_TYPE_VALUES,
} from "@/lib/identification-types";
import { COLOMBIA_EPS_OPTIONS, EPS_OTHER_OPTION } from "@/lib/student-options";
import { Professor } from "@/lib/types";
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

export default function EditProfessorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [professor, setProfessor] = useState<Professor | null>(null);

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

  useEffect(() => {
    async function fetchProfessor() {
      const result = await getProfessorById(id);

      if (!result.success || !result.data) {
        setFetchError("No se encontró el profesor");
        setIsFetching(false);
        return;
      }

      const p = result.data as Professor;
      setProfessor(p);

      const tipoIdentificacion = IDENTIFICATION_TYPE_VALUES.includes(
        p.tipo_identificacion as (typeof IDENTIFICATION_TYPE_VALUES)[number],
      )
        ? (p.tipo_identificacion as ProfessorFormValues["tipo_identificacion"])
        : "CC";

      const epsInList = COLOMBIA_EPS_OPTIONS.includes(
        p.eps as (typeof COLOMBIA_EPS_OPTIONS)[number],
      );

      form.reset({
        tipo_identificacion: tipoIdentificacion,
        numero_identificacion: p.numero_identificacion,
        nombres: p.nombres,
        apellidos: p.apellidos,
        email: p.email,
        telefono: p.telefono,
        direccion: p.direccion,
        barrio: p.barrio,
        nombre_contacto_emergencia: p.nombre_contacto_emergencia,
        telefono_contacto_emergencia: p.telefono_contacto_emergencia,
        eps_select: epsInList ? p.eps : EPS_OTHER_OPTION,
        eps_otra: epsInList ? "" : p.eps,
      });
      setIsFetching(false);
    }

    fetchProfessor();
  }, [id, form]);

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
      const res = await fetch("/api/professors/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero_identificacion: id,
          data: {
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
          },
        }),
      });

      const result = await res.json().catch(() => ({ success: false }));
      if (!res.ok || !result.success) {
        toast.error(result.error ?? "Error al actualizar el profesor");
        return;
      }

      const nextId = values.numero_identificacion;
      toast.success("Profesor actualizado correctamente");
      router.replace(`/dashboard/professors/${nextId}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error desconocido al actualizar",
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-600">{fetchError}</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/dashboard/professors">Volver a Profesores</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href={`/dashboard/professors/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar Profesor</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {professor?.nombres} {professor?.apellidos}
          </p>
        </div>
      </div>

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Actualización de profesor</CardTitle>
          <CardDescription>Campos alineados con db_schema.sql</CardDescription>
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
                  "Guardar cambios"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
