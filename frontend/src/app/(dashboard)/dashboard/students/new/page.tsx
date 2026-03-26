"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createStudent } from "@/app/actions/students";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const studentSchema = z.object({
  numero_identificacion: z
    .string()
    .min(1, "La identificación es requerida")
    .max(20),
  no_matricula: z.string().max(20).optional(),
  nombres: z.string().min(2, "Los nombres son requeridos").max(100),
  apellidos: z.string().min(2, "Los apellidos son requeridos").max(100),
  grado: z
    .string()
    .min(1, "El grado es requerido")
    .refine(
      (val) =>
        Number.isInteger(Number(val)) && Number(val) >= 1 && Number(val) <= 11,
      {
        message: "El grado debe estar entre 1 y 11",
      },
    ),
  telefono: z.string().max(20).optional(),
  direccion: z.string().max(200).optional(),
  barrio: z.string().max(100).optional(),
  nombre_acudiente: z.string().max(200).optional(),
  telefono_acudiente: z.string().max(20).optional(),
  programa: z.string().max(100).optional(),
  fecha_inicio: z.string().optional(),
  fecha_matricula: z.string().optional(),
  valor_matricula: z
    .string()
    .optional()
    .refine((val) => !val || (!Number.isNaN(Number(val)) && Number(val) >= 0), {
      message: "El valor de matrícula debe ser mayor o igual a 0",
    }),
  matricula_cancelada: z.boolean().optional(),
  valor_apoyo_semanal: z
    .string()
    .min(1, "El valor de apoyo semanal es requerido")
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) > 0, {
      message: "El valor de apoyo semanal debe ser mayor que 0",
    }),
  huella_indice_derecho: z.string().optional(),
  huella_indice_izquierdo: z.string().optional(),
  firma: z.string().optional(),
});

type StudentFormValues = z.input<typeof studentSchema>;

export default function NewStudentPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      numero_identificacion: "",
      no_matricula: "",
      nombres: "",
      apellidos: "",
      grado: "",
      telefono: "",
      direccion: "",
      barrio: "",
      nombre_acudiente: "",
      telefono_acudiente: "",
      programa: "",
      fecha_inicio: "",
      fecha_matricula: "",
      valor_matricula: "",
      matricula_cancelada: false,
      valor_apoyo_semanal: "",
      huella_indice_derecho: "",
      huella_indice_izquierdo: "",
      firma: "",
    },
  });

  async function onSubmit(values: StudentFormValues) {
    setIsLoading(true);

    const result = await createStudent({
      numero_identificacion: values.numero_identificacion,
      no_matricula: values.no_matricula || null,
      nombres: values.nombres,
      apellidos: values.apellidos,
      grado: Number(values.grado),
      telefono: values.telefono || null,
      direccion: values.direccion || null,
      barrio: values.barrio || null,
      nombre_acudiente: values.nombre_acudiente || null,
      telefono_acudiente: values.telefono_acudiente || null,
      programa: values.programa || null,
      fecha_inicio: values.fecha_inicio || null,
      fecha_matricula: values.fecha_matricula || null,
      valor_matricula: values.valor_matricula
        ? Number(values.valor_matricula)
        : null,
      matricula_cancelada: values.matricula_cancelada ?? false,
      valor_apoyo_semanal: Number(values.valor_apoyo_semanal),
      huella_indice_derecho: values.huella_indice_derecho || null,
      huella_indice_izquierdo: values.huella_indice_izquierdo || null,
      firma: values.firma || null,
    });

    if (result.success) {
      toast.success("Estudiante creado correctamente");
      router.push("/dashboard/students");
      router.refresh();
    } else {
      toast.error(result.error ?? "Error al crear el estudiante");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/students">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Estudiante</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Formulario basado en db_schema.sql
          </p>
        </div>
      </div>

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Registro de estudiante</CardTitle>
          <CardDescription>
            Complete los campos obligatorios y opcionales del esquema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="numero_identificacion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de identificación *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: 1234567890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="no_matricula"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>No. matrícula</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Opcional (se autogenera si está vacío)"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="grado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grado (1-11) *</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={11} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="programa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Programa</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="direccion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección</FormLabel>
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
                      <FormLabel>Barrio</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nombre_acudiente"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del acudiente</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="telefono_acudiente"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono del acudiente</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fecha_inicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de inicio</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fecha_matricula"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de matrícula</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="valor_matricula"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor matrícula</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="valor_apoyo_semanal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor apoyo semanal *</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="matricula_cancelada"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Matrícula cancelada</FormLabel>
                      <FormControl>
                        <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={(event) =>
                              field.onChange(event.target.checked)
                            }
                          />
                          Marcar si ya pagó matrícula
                        </label>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="huella_indice_derecho"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Huella índice derecho</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="huella_indice_izquierdo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Huella índice izquierdo</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="firma"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Firma</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  disabled={isLoading}
                >
                  <Link href="/dashboard/students">Cancelar</Link>
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar Estudiante"
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
