"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  associateStudentsToCourse,
  dissociateStudentsFromCourse,
  getCourseById,
  getStudentsByCourseId,
} from "@/app/actions/courses";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const associationSchema = z.object({
  operation: z.enum(["link", "unlink"]),
  studentIdsRaw: z.string().min(1, "Ingrese al menos un numero_identificacion"),
  idCurso: z
    .string()
    .min(1, "El id_curso es requerido")
    .refine((value) => Number.isInteger(Number(value)) && Number(value) > 0, {
      message: "Ingrese un id_curso válido",
    }),
});

type AssociationFormValues = z.infer<typeof associationSchema>;

export default function CourseStudentAssociationPage() {
  const [course, setCourse] = useState<Course | null>(null);
  const [linkedStudents, setLinkedStudents] = useState<
    Array<{
      numero_identificacion: string;
      nombres: string;
      apellidos: string;
      no_matricula: string | null;
      grado: number;
      tipo_identificacion: string | null;
    }>
  >([]);
  const [isSearchingCourse, setIsSearchingCourse] = useState(false);
  const [isAssociating, setIsAssociating] = useState(false);
  const [isLoadingLinkedStudents, setIsLoadingLinkedStudents] = useState(false);
  const [unlinkingStudentId, setUnlinkingStudentId] = useState<string | null>(
    null,
  );

  const form = useForm<AssociationFormValues>({
    resolver: zodResolver(associationSchema),
    defaultValues: {
      operation: "link",
      studentIdsRaw: "",
      idCurso: "",
    },
  });

  const studentIds = useMemo(() => {
    const raw = form.watch("studentIdsRaw") ?? "";
    return Array.from(
      new Set(
        raw
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    );
  }, [form.watch("studentIdsRaw")]);

  async function loadLinkedStudents(idCurso: number) {
    setIsLoadingLinkedStudents(true);
    const result = await getStudentsByCourseId(idCurso);
    setIsLoadingLinkedStudents(false);

    if (!result.success) {
      setLinkedStudents([]);
      toast.error(
        result.error ?? "No fue posible cargar estudiantes del curso",
      );
      return;
    }

    setLinkedStudents(result.data ?? []);
  }

  async function handleSearchCourse() {
    const idCursoRaw = form.getValues("idCurso");
    const idCurso = Number(idCursoRaw);

    if (!idCursoRaw || !Number.isInteger(idCurso) || idCurso <= 0) {
      form.setError("idCurso", { message: "Ingrese un id_curso válido" });
      return;
    }

    setIsSearchingCourse(true);
    const result = await getCourseById(idCurso);
    setIsSearchingCourse(false);

    if (!result.success || !result.data) {
      setCourse(null);
      setLinkedStudents([]);
      toast.error(result.error ?? "No se encontró el curso");
      return;
    }

    setCourse(result.data);
    await loadLinkedStudents(idCurso);
    toast.success("Curso encontrado");
  }

  async function handleUnlinkSingle(studentId: string) {
    if (!course) {
      toast.error("Primero busque y confirme un curso válido");
      return;
    }

    setUnlinkingStudentId(studentId);
    const result = await dissociateStudentsFromCourse(course.id_curso, [
      studentId,
    ]);
    setUnlinkingStudentId(null);

    if (!result.success) {
      toast.error(result.error ?? "No fue posible desvincular el estudiante");
      return;
    }

    toast.success("Estudiante desvinculado correctamente");
    await loadLinkedStudents(course.id_curso);
  }

  async function onSubmit(values: AssociationFormValues) {
    if (!course) {
      toast.error("Primero busque y confirme un curso válido");
      return;
    }

    const ids = values.studentIdsRaw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      toast.error("Ingrese al menos un numero_identificacion");
      return;
    }

    setIsAssociating(true);
    if (values.operation === "link") {
      const result = await associateStudentsToCourse(
        Number(values.idCurso),
        ids,
      );
      setIsAssociating(false);

      if (!result.success) {
        toast.error(
          result.error ?? "No fue posible asociar estudiantes al curso",
        );
        return;
      }

      toast.success(
        `Asociación completada: ${result.insertedCount ?? ids.length} estudiante(s) vinculados`,
      );
    } else {
      const result = await dissociateStudentsFromCourse(
        Number(values.idCurso),
        ids,
      );
      setIsAssociating(false);

      if (!result.success) {
        toast.error(
          result.error ?? "No fue posible desvincular estudiantes del curso",
        );
        return;
      }

      toast.success(
        `Desvinculación completada: ${result.removedCount ?? ids.length} estudiante(s) desvinculados`,
      );
    }

    form.reset({
      operation: values.operation,
      studentIdsRaw: "",
      idCurso: values.idCurso,
    });

    await loadLinkedStudents(Number(values.idCurso));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-[#b92f2d]/10 p-2">
          <Link2 className="h-5 w-5 text-[#b92f2d]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Asociar Cursos con Estudiantes
          </h1>
          <p className="text-gray-500 mt-1">
            Primero busque un curso por ID. Luego podrá ver sus estudiantes y
            gestionar vinculación o desvinculación.
          </p>
        </div>
      </div>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Asociación de estudiantes</CardTitle>
          <CardDescription>
            Busque un curso para habilitar las opciones de gestión.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-[220px_auto] gap-4 items-end">
                <FormField
                  control={form.control}
                  name="idCurso"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>id_curso *</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="button"
                  onClick={handleSearchCourse}
                  disabled={isSearchingCourse}
                  className="bg-[#b92f2d] hover:bg-[#982725] text-white"
                >
                  {isSearchingCourse ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    "Buscar Curso"
                  )}
                </Button>
              </div>

              {course && (
                <Card className="border-[#b92f2d]/30 bg-[#b92f2d]/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-[#982725]">
                      Curso encontrado
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <p>
                      <span className="font-semibold">ID:</span>{" "}
                      {course.id_curso}
                    </p>
                    <p>
                      <span className="font-semibold">Nombre:</span>{" "}
                      {course.nombre_curso}
                    </p>
                    <p>
                      <span className="font-semibold">Nivel:</span>{" "}
                      {course.nivel_curso}
                    </p>
                    <p>
                      <span className="font-semibold">Horario:</span>{" "}
                      {course.hora_inicio} - {course.hora_fin}
                    </p>
                    <p>
                      <span className="font-semibold">Fecha inicio:</span>{" "}
                      {course.fecha_inicio}
                    </p>
                    <p>
                      <span className="font-semibold">Fecha fin:</span>{" "}
                      {course.fecha_fin}
                    </p>
                  </CardContent>
                </Card>
              )}

              {course && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Estudiantes del curso
                    </CardTitle>
                    {/* <CardDescription>
                      Puede desvincular estudiantes individualmente desde esta
                      lista.
                    </CardDescription> */}
                  </CardHeader>
                  <CardContent>
                    {isLoadingLinkedStudents ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando estudiantes...
                      </div>
                    ) : linkedStudents.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        Este curso no tiene estudiantes vinculados actualmente.
                      </p>
                    ) : (
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead>Identificación</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>No. Matrícula</TableHead>
                              <TableHead>Nombres</TableHead>
                              <TableHead>Apellidos</TableHead>
                              <TableHead>Grado</TableHead>
                              <TableHead className="text-right">
                                Acción
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {linkedStudents.map((student) => (
                              <TableRow key={student.numero_identificacion}>
                                <TableCell className="font-mono text-xs sm:text-sm">
                                  {student.numero_identificacion}
                                </TableCell>
                                <TableCell>
                                  {student.tipo_identificacion ?? "-"}
                                </TableCell>
                                <TableCell>
                                  {student.no_matricula ?? "-"}
                                </TableCell>
                                <TableCell>{student.nombres}</TableCell>
                                <TableCell>{student.apellidos}</TableCell>
                                <TableCell>{student.grado}</TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() =>
                                      handleUnlinkSingle(
                                        student.numero_identificacion,
                                      )
                                    }
                                    disabled={
                                      unlinkingStudentId ===
                                      student.numero_identificacion
                                    }
                                  >
                                    {unlinkingStudentId ===
                                    student.numero_identificacion ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                    <span className="sr-only">Desvincular</span>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {course && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Gestión masiva</CardTitle>
                    <CardDescription>
                      Vincule o desvincule múltiples estudiantes separados por
                      comas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 items-end">
                      <FormField
                        control={form.control}
                        name="operation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Operación *</FormLabel>
                            <FormControl>
                              <select
                                value={field.value}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                              >
                                <option value="link">Vincular</option>
                                <option value="unlink">Desvincular</option>
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="studentIdsRaw"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              numero_identificacion (1 o N, separados por comas)
                              *
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ej: 1001,1002,1003"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="rounded-md border border-gray-200 p-3 bg-gray-50">
                      <p className="text-sm text-gray-700">
                        Estudiantes detectados:{" "}
                        <span className="font-semibold">
                          {studentIds.length}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1 break-all">
                        {studentIds.length > 0
                          ? studentIds.join(", ")
                          : "Sin identificaciones cargadas"}
                      </p>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={isAssociating}
                        className="bg-[#b92f2d] hover:bg-[#982725] text-white"
                      >
                        {isAssociating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Procesando...
                          </>
                        ) : form.watch("operation") === "link" ? (
                          "Vincular Estudiantes al Curso"
                        ) : (
                          "Desvincular Estudiantes del Curso"
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
