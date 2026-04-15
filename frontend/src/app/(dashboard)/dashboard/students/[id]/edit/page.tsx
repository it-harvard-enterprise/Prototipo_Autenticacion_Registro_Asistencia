"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { updateStudent } from "@/app/actions/students";
import {
  IDENTIFICATION_TYPE_OPTIONS,
  IDENTIFICATION_TYPE_VALUES,
} from "@/lib/identification-types";
import {
  COLOMBIA_EPS_OPTIONS,
  EPS_OTHER_OPTION,
  PAYMENT_METHOD_OPTIONS,
  STUDENT_COORDINATOR_OPTIONS,
  STUDENT_GRADE_OPTIONS,
} from "@/lib/student-options";
import { Student } from "@/lib/types";
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

const studentSchema = z
  .object({
    tipo_identificacion: z.enum(IDENTIFICATION_TYPE_VALUES, {
      message: "Debe seleccionar un tipo de identificacion",
    }),
    numero_identificacion: z
      .string()
      .min(1, "La identificación es requerida")
      .max(20),
    no_matricula: z.string().max(20).optional(),
    nombres: z.string().min(2, "Los nombres son requeridos").max(100),
    apellidos: z.string().min(2, "Los apellidos son requeridos").max(100),
    grado: z.enum(STUDENT_GRADE_OPTIONS, {
      message: "Debe seleccionar un grado válido",
    }),
    telefono: z.string().min(1, "El teléfono es requerido").max(20),
    direccion: z.string().min(1, "La dirección es requerida").max(200),
    barrio: z.string().min(1, "El barrio es requerido").max(100),
    nombre_acudiente: z
      .string()
      .min(1, "El nombre del acudiente es requerido")
      .max(200),
    telefono_acudiente: z
      .string()
      .min(1, "El teléfono del acudiente es requerido")
      .max(20),
    eps_select: z.string().min(1, "Debe seleccionar una EPS"),
    eps_otra: z.string().optional(),
    coordinador_academico: z.enum(STUDENT_COORDINATOR_OPTIONS, {
      message: "Debe seleccionar un coordinador académico",
    }),
    programa: z.string().min(1, "El programa es requerido").max(100),
    fecha_inicio: z.string().min(1, "La fecha de inicio es requerida"),
    fecha_matricula: z.string().min(1, "La fecha de matrícula es requerida"),
    valor_matricula: z
      .string()
      .min(1, "El valor de matrícula es requerido")
      .refine((val) => !Number.isNaN(Number(val)) && Number(val) >= 0, {
        message: "El valor de matrícula debe ser mayor o igual a 0",
      }),
    medio_pago_matricula: z.enum(
      PAYMENT_METHOD_OPTIONS.map((item) => item.value) as [
        "efectivo",
        "transferencia",
        "nequi",
        "daviplata",
        "otro",
      ],
      {
        message: "Debe seleccionar el medio de pago de matrícula",
      },
    ),
    valor_apoyo_semanal: z
      .string()
      .min(1, "El valor de apoyo semanal es requerido")
      .refine((val) => !Number.isNaN(Number(val)) && Number(val) > 0, {
        message: "El valor de apoyo semanal debe ser mayor que 0",
      }),
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

type StudentFormValues = z.input<typeof studentSchema>;

export default function EditStudentPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      tipo_identificacion: "CC",
      numero_identificacion: "",
      no_matricula: "",
      nombres: "",
      apellidos: "",
      grado: "1",
      telefono: "",
      direccion: "",
      barrio: "",
      nombre_acudiente: "",
      telefono_acudiente: "",
      eps_select: "Nueva EPS",
      eps_otra: "",
      coordinador_academico: "Nicol Delgado",
      programa: "",
      fecha_inicio: "",
      fecha_matricula: "",
      valor_matricula: "",
      medio_pago_matricula: "efectivo",
      valor_apoyo_semanal: "",
    },
  });

  useEffect(() => {
    async function fetchStudent() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("estudiantes")
        .select("*")
        .eq("numero_identificacion", id)
        .single();

      if (error || !data) {
        setFetchError("No se encontró el estudiante");
        setIsFetching(false);
        return;
      }

      const s = data as Student;
      setStudent(s);
      const tipoIdentificacion = IDENTIFICATION_TYPE_VALUES.includes(
        s.tipo_identificacion as (typeof IDENTIFICATION_TYPE_VALUES)[number],
      )
        ? (s.tipo_identificacion as StudentFormValues["tipo_identificacion"])
        : "CC";

      const epsInList = COLOMBIA_EPS_OPTIONS.includes(
        s.eps as (typeof COLOMBIA_EPS_OPTIONS)[number],
      );

      form.reset({
        tipo_identificacion: tipoIdentificacion,
        numero_identificacion: s.numero_identificacion,
        no_matricula: s.no_matricula ?? "",
        nombres: s.nombres,
        apellidos: s.apellidos,
        grado: s.grado as StudentFormValues["grado"],
        telefono: s.telefono,
        direccion: s.direccion,
        barrio: s.barrio,
        nombre_acudiente: s.nombre_acudiente,
        telefono_acudiente: s.telefono_acudiente,
        eps_select: epsInList ? s.eps : EPS_OTHER_OPTION,
        eps_otra: epsInList ? "" : s.eps,
        coordinador_academico:
          s.coordinador_academico as StudentFormValues["coordinador_academico"],
        programa: s.programa,
        fecha_inicio: s.fecha_inicio,
        fecha_matricula: s.fecha_matricula,
        valor_matricula: String(s.valor_matricula),
        medio_pago_matricula: s.medio_pago_matricula,
        valor_apoyo_semanal: String(s.valor_apoyo_semanal),
      });
      setIsFetching(false);
    }

    fetchStudent();
  }, [id, form]);

  async function onSubmit(values: StudentFormValues) {
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
      const result = await updateStudent(id, {
        tipo_identificacion: values.tipo_identificacion,
        numero_identificacion: values.numero_identificacion,
        no_matricula: values.no_matricula || null,
        nombres: values.nombres,
        apellidos: values.apellidos,
        grado: values.grado,
        telefono: values.telefono,
        direccion: values.direccion,
        barrio: values.barrio,
        nombre_acudiente: values.nombre_acudiente,
        telefono_acudiente: values.telefono_acudiente,
        eps: epsValue,
        coordinador_academico: values.coordinador_academico,
        programa: values.programa,
        fecha_inicio: values.fecha_inicio,
        fecha_matricula: values.fecha_matricula,
        valor_matricula: Number(values.valor_matricula),
        medio_pago_matricula: values.medio_pago_matricula,
        valor_apoyo_semanal: Number(values.valor_apoyo_semanal),
      });

      if (!result.success) {
        toast.error(result.error ?? "Error al actualizar el estudiante");
        return;
      }

      const nextId =
        result.data?.numero_identificacion ?? values.numero_identificacion;
      toast.success("Estudiante actualizado correctamente");
      router.replace(`/dashboard/students/${nextId}`);
    } catch {
      toast.error("Error inesperado al actualizar el estudiante");
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
          <Link href="/dashboard/students">Volver a Estudiantes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href={`/dashboard/students/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Editar Estudiante
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {student?.nombres} {student?.apellidos}
          </p>
        </div>
      </div>

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Actualización de estudiante</CardTitle>
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
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                  name="no_matricula"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>No. matrícula</FormLabel>
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
                      <FormLabel>Grado *</FormLabel>
                      <FormControl>
                        <select
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          {STUDENT_GRADE_OPTIONS.map((grade) => (
                            <option key={grade} value={grade}>
                              {grade}
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
                  name="programa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Programa *</FormLabel>
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
                      <FormLabel>Teléfono *</FormLabel>
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="nombre_acudiente"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del acudiente *</FormLabel>
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
                      <FormLabel>Teléfono del acudiente *</FormLabel>
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
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          {COLOMBIA_EPS_OPTIONS.map((eps) => (
                            <option key={eps} value={eps}>
                              {eps}
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
                  name="coordinador_academico"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Coordinador académico *</FormLabel>
                      <FormControl>
                        <select
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          {STUDENT_COORDINATOR_OPTIONS.map((coordinator) => (
                            <option key={coordinator} value={coordinator}>
                              {coordinator}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {form.watch("eps_select") === EPS_OTHER_OPTION && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="eps_otra"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Escriba la EPS *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Mi EPS" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fecha_inicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de inicio *</FormLabel>
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
                      <FormLabel>Fecha de matrícula *</FormLabel>
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
                      <FormLabel>Valor matrícula *</FormLabel>
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
                  name="medio_pago_matricula"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medio de pago matrícula *</FormLabel>
                      <FormControl>
                        <select
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          {PAYMENT_METHOD_OPTIONS.map((option) => (
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
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  disabled={isLoading}
                >
                  <Link href={`/dashboard/students/${id}`}>Cancelar</Link>
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
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
