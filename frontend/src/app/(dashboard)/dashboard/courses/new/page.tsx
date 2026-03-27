"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createCourse } from "@/app/actions/courses";
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

export default function NewCoursePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

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

  async function onSubmit(values: CourseFormValues) {
    setIsLoading(true);

    const result = await createCourse({
      nombre_curso: values.nombre_curso,
      nivel_curso: values.nivel_curso,
      hora_inicio: values.hora_inicio,
      hora_fin: values.hora_fin,
      salon: values.salon || null,
      fecha_inicio: values.fecha_inicio,
      fecha_fin: values.fecha_fin,
    });

    if (result.success) {
      toast.success("Curso creado correctamente");
      router.push("/dashboard/courses");
      router.refresh();
    } else {
      toast.error(result.error ?? "Error al crear el curso");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/courses">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Curso</h1>
        </div>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Información del curso</CardTitle>
          <CardDescription>
            Ingrese los datos requeridos para crear un curso nuevo.
          </CardDescription>
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
                        <Input
                          placeholder="Ej: Básico, Intermedio, Avanzado"
                          {...field}
                        />
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
                        <Input placeholder="Ej: Salón 3" {...field} />
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
                  <Link href="/dashboard/courses">Cancelar</Link>
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar Curso"
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
