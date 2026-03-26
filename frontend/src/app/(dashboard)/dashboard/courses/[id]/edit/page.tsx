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
import { updateCourse } from "@/app/actions/courses";
import { Course } from "@/lib/types";
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

const courseSchema = z
  .object({
    nombre_curso: z
      .string()
      .min(2, "El nombre del curso es requerido")
      .max(150),
    nivel_curso: z.string().min(1, "El nivel es requerido").max(50),
    hora_inicio: z.string().min(1, "La hora de inicio es requerida"),
    hora_fin: z.string().min(1, "La hora de fin es requerida"),
    salon: z.string().max(50).optional(),
    fecha_inicio: z.string().min(1, "La fecha de inicio es requerida"),
    fecha_fin: z.string().min(1, "La fecha de fin es requerida"),
  })
  .refine((values) => values.hora_fin > values.hora_inicio, {
    message: "La hora de fin debe ser mayor que la hora de inicio",
    path: ["hora_fin"],
  })
  .refine((values) => values.fecha_fin > values.fecha_inicio, {
    message: "La fecha de fin debe ser mayor que la fecha de inicio",
    path: ["fecha_fin"],
  });

type CourseFormValues = z.infer<typeof courseSchema>;

export default function EditCoursePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      nombre_curso: "",
      nivel_curso: "",
      hora_inicio: "",
      hora_fin: "",
      salon: "",
      fecha_inicio: "",
      fecha_fin: "",
    },
  });

  useEffect(() => {
    async function fetchCourse() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("cursos")
        .select("*")
        .eq("id_curso", Number(id))
        .single();

      if (error || !data) {
        setFetchError("No se encontró el curso");
        setIsFetching(false);
        return;
      }

      const c = data as Course;
      setCourse(c);
      form.reset({
        nombre_curso: c.nombre_curso,
        nivel_curso: c.nivel_curso,
        hora_inicio: c.hora_inicio,
        hora_fin: c.hora_fin,
        salon: c.salon ?? "",
        fecha_inicio: c.fecha_inicio,
        fecha_fin: c.fecha_fin,
      });
      setIsFetching(false);
    }

    fetchCourse();
  }, [id, form]);

  async function onSubmit(values: CourseFormValues) {
    setIsLoading(true);

    const result = await updateCourse(Number(id), {
      nombre_curso: values.nombre_curso,
      nivel_curso: values.nivel_curso,
      hora_inicio: values.hora_inicio,
      hora_fin: values.hora_fin,
      salon: values.salon || null,
      fecha_inicio: values.fecha_inicio,
      fecha_fin: values.fecha_fin,
    });

    if (result.success) {
      toast.success("Curso actualizado correctamente");
      router.push(`/dashboard/courses/${id}`);
      router.refresh();
    } else {
      toast.error(result.error ?? "Error al actualizar el curso");
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
          <Link href="/dashboard/courses">Volver a Cursos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href={`/dashboard/courses/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar Curso</h1>
          <p className="text-gray-500 mt-0.5 text-sm">{course?.nombre_curso}</p>
        </div>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Actualización de curso</CardTitle>
          <CardDescription>Campos alineados con db_schema.sql</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="nombre_curso"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del curso *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nivel_curso"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nivel del curso *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="salon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Salón</FormLabel>
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
                  name="hora_inicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hora de inicio *</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hora_fin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hora de fin *</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
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
                  name="fecha_fin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de fin *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
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
                  <Link href={`/dashboard/courses/${id}`}>Cancelar</Link>
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
