"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, Loader2, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { getCourseOptions, type CourseOption } from "@/app/actions/attendance";
import {
  associateParticipantsToCourse,
  dissociateParticipantsFromCourse,
  getCourseById,
  getParticipantsByCourseId,
  lookupParticipantsByIdentification,
  type LinkedParticipantRow,
  type ParticipantRole,
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
  participantIdsRaw: z
    .string()
    .min(1, "Ingrese al menos un número de identificación"),
  idCurso: z
    .string()
    .min(1, "El id_curso es requerido")
    .refine((value) => Number.isInteger(Number(value)) && Number(value) > 0, {
      message: "Ingrese un id_curso válido",
    }),
});

type AssociationFormValues = z.infer<typeof associationSchema>;

function roleLabel(role: ParticipantRole): string {
  switch (role) {
    case "ESTUDIANTE":
      return "ESTUDIANTE";
    case "PROFESOR":
      return "PROFESOR";
    case "ESTUDIANTE_Y_PROFESOR":
      return "ESTUDIANTE Y PROFESOR";
    default:
      return "NO ENCONTRADO";
  }
}

function roleClasses(role: ParticipantRole): string {
  switch (role) {
    case "ESTUDIANTE":
      return "bg-blue-100 text-blue-800";
    case "PROFESOR":
      return "bg-emerald-100 text-emerald-800";
    case "ESTUDIANTE_Y_PROFESOR":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-red-100 text-red-800";
  }
}

export default function CourseStudentAssociationPage() {
  const [course, setCourse] = useState<Course | null>(null);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [linkedParticipants, setLinkedParticipants] = useState<
    LinkedParticipantRow[]
  >([]);
  const [previewMatches, setPreviewMatches] = useState<
    Array<{ numero_identificacion: string; role: ParticipantRole }>
  >([]);
  const [isSearchingCourse, setIsSearchingCourse] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [courseSearch, setCourseSearch] = useState("");
  const [showCourseList, setShowCourseList] = useState(false);
  const [isAssociating, setIsAssociating] = useState(false);
  const [isLoadingLinkedParticipants, setIsLoadingLinkedParticipants] =
    useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [unlinkingParticipantId, setUnlinkingParticipantId] = useState<
    string | null
  >(null);

  const form = useForm<AssociationFormValues>({
    resolver: zodResolver(associationSchema),
    defaultValues: {
      operation: "link",
      participantIdsRaw: "",
      idCurso: "",
    },
  });

  const participantIdsRaw = form.watch("participantIdsRaw");

  const participantIds = useMemo(() => {
    const raw = participantIdsRaw ?? "";
    return Array.from(
      new Set(
        raw
          .split(",")
          .map((id) => id.trim().toUpperCase())
          .filter(Boolean),
      ),
    );
  }, [participantIdsRaw]);

  const filteredCourses = useMemo(() => {
    const query = courseSearch.trim().toLowerCase();
    if (!query) return courses;

    return courses.filter((courseOption) => {
      const idMatch = String(courseOption.id_curso).includes(query);
      const nameMatch = courseOption.nombre_curso.toLowerCase().includes(query);
      return idMatch || nameMatch;
    });
  }, [courseSearch, courses]);

  useEffect(() => {
    async function fetchCourses() {
      setIsLoadingCourses(true);
      const result = await getCourseOptions();
      setIsLoadingCourses(false);

      if (!result.success) {
        toast.error(result.error ?? "No se pudieron cargar los cursos");
        return;
      }

      setCourses(result.data ?? []);
    }

    fetchCourses();
  }, []);

  useEffect(() => {
    if (!courses.length) return;

    const currentId = form.getValues("idCurso");
    if (!currentId) return;

    const selected = courses.find(
      (courseOption) => String(courseOption.id_curso) === String(currentId),
    );
    if (!selected) return;

    setCourseSearch(`${selected.id_curso} - ${selected.nombre_curso}`);
  }, [courses, form]);

  useEffect(() => {
    let cancelled = false;

    if (participantIds.length === 0) {
      setPreviewMatches([]);
      setIsPreviewLoading(false);
      return;
    }

    setIsPreviewLoading(true);
    const timer = setTimeout(async () => {
      const result = await lookupParticipantsByIdentification(participantIds);
      if (cancelled) return;

      setIsPreviewLoading(false);
      if (!result.success) {
        setPreviewMatches([]);
        toast.error(
          result.error ??
            "No fue posible validar identificaciones de participantes",
        );
        return;
      }

      setPreviewMatches(result.data ?? []);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [participantIds]);

  async function loadLinkedParticipants(idCurso: number) {
    setIsLoadingLinkedParticipants(true);
    const result = await getParticipantsByCourseId(idCurso);
    setIsLoadingLinkedParticipants(false);

    if (!result.success) {
      setLinkedParticipants([]);
      toast.error(
        result.error ?? "No fue posible cargar participantes del curso",
      );
      return;
    }

    setLinkedParticipants(result.data ?? []);
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
      setLinkedParticipants([]);
      toast.error(result.error ?? "No se encontró el curso");
      return;
    }

    setCourse(result.data);
    await loadLinkedParticipants(idCurso);
    toast.success("Curso encontrado");
  }

  async function handleUnlinkSingle(participantId: string) {
    if (!course) {
      toast.error("Primero busque y confirme un curso válido");
      return;
    }

    setUnlinkingParticipantId(participantId);
    const result = await dissociateParticipantsFromCourse(course.id_curso, [
      participantId,
    ]);
    setUnlinkingParticipantId(null);

    if (!result.success) {
      toast.error(result.error ?? "No fue posible desvincular el participante");
      return;
    }

    toast.success("Participante desvinculado correctamente");
    await loadLinkedParticipants(course.id_curso);
  }

  async function onSubmit(values: AssociationFormValues) {
    if (!course) {
      toast.error("Primero busque y confirme un curso válido");
      return;
    }

    const ids = values.participantIdsRaw
      .split(",")
      .map((id) => id.trim().toUpperCase())
      .filter(Boolean);

    if (ids.length === 0) {
      toast.error("Ingrese al menos un número de identificación");
      return;
    }

    setIsAssociating(true);
    if (values.operation === "link") {
      const result = await associateParticipantsToCourse(
        Number(values.idCurso),
        ids,
      );
      setIsAssociating(false);

      if (!result.success) {
        toast.error(
          result.error ?? "No fue posible asociar participantes al curso",
        );
        return;
      }

      toast.success(
        `Asociación completada: ${result.insertedCount ?? ids.length} participante(s) vinculados`,
      );
    } else {
      const result = await dissociateParticipantsFromCourse(
        Number(values.idCurso),
        ids,
      );
      setIsAssociating(false);

      if (!result.success) {
        toast.error(
          result.error ?? "No fue posible desvincular participantes del curso",
        );
        return;
      }

      toast.success(
        `Desvinculación completada: ${result.removedCount ?? ids.length} participante(s) desvinculados`,
      );
    }

    form.reset({
      operation: values.operation,
      participantIdsRaw: "",
      idCurso: values.idCurso,
    });

    await loadLinkedParticipants(Number(values.idCurso));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-[#b92f2d]/10 p-2">
          <Link2 className="h-5 w-5 text-[#b92f2d]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Asociar Cursos con Participantes
          </h1>
          <p className="text-gray-500 mt-1">
            Primero busque un curso por ID. Luego podrá ver estudiantes y
            profesores, y gestionar su vinculación o desvinculación.
          </p>
        </div>
      </div>

      <Card className="max-w-4xl overflow-visible">
        <CardHeader>
          <CardTitle>Asociación de Participantes</CardTitle>
          <CardDescription>
            Busque un curso para habilitar las opciones de gestión.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-visible">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-5 overflow-visible"
            >
              <div className="relative z-30 grid grid-cols-1 sm:grid-cols-[minmax(360px,1fr)_auto] gap-4 items-end">
                <FormField
                  control={form.control}
                  name="idCurso"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID del Curso *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder={
                              isLoadingCourses
                                ? "Cargando cursos..."
                                : "Escriba el nombre o id del curso"
                            }
                            value={courseSearch}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setCourseSearch(nextValue);
                              setShowCourseList(true);

                              const directId = nextValue.trim();
                              const idMatch = courses.find(
                                (courseOption) =>
                                  String(courseOption.id_curso) === directId,
                              );
                              const labelMatch = courses.find((courseOption) =>
                                `${courseOption.id_curso} - ${courseOption.nombre_curso}`
                                  .toLowerCase()
                                  .startsWith(directId.toLowerCase()),
                              );

                              const selectedCourse = idMatch ?? labelMatch;
                              if (selectedCourse) {
                                field.onChange(String(selectedCourse.id_curso));
                              } else {
                                field.onChange("");
                              }
                            }}
                            onFocus={() => setShowCourseList(true)}
                            onBlur={() => {
                              setTimeout(() => setShowCourseList(false), 120);
                            }}
                            disabled={isLoadingCourses}
                          />

                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => setShowCourseList((prev) => !prev)}
                            disabled={isLoadingCourses}
                            aria-label="Mostrar lista de cursos"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>

                          {showCourseList && filteredCourses.length > 0 && (
                            <div className="absolute z-[70] mt-1 max-h-56 w-full overflow-auto rounded-md border border-input bg-white shadow-sm">
                              {filteredCourses.map((courseOption) => (
                                <button
                                  key={courseOption.id_curso}
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                  onMouseDown={(event) =>
                                    event.preventDefault()
                                  }
                                  onClick={() => {
                                    const label = `${courseOption.id_curso} - ${courseOption.nombre_curso}`;
                                    setCourseSearch(label);
                                    field.onChange(
                                      String(courseOption.id_curso),
                                    );
                                    setShowCourseList(false);
                                  }}
                                >
                                  {courseOption.id_curso} -{" "}
                                  {courseOption.nombre_curso}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="button"
                  onClick={handleSearchCourse}
                  disabled={isSearchingCourse}
                  size="sm"
                  className="h-8 px-3 bg-[#b92f2d] hover:bg-[#982725] text-white"
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
                      Curso Encontrado
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
                  </CardContent>
                </Card>
              )}

              {course && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Participantes del Curso
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingLinkedParticipants ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando participantes...
                      </div>
                    ) : linkedParticipants.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        Este curso no tiene participantes vinculados
                        actualmente.
                      </p>
                    ) : (
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead>Identificación</TableHead>
                              <TableHead>Rol</TableHead>
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
                            {linkedParticipants.map((participant) => (
                              <TableRow
                                key={`${participant.role}-${participant.numero_identificacion}`}
                              >
                                <TableCell className="font-mono text-xs sm:text-sm">
                                  {participant.numero_identificacion}
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                      participant.role === "ESTUDIANTE"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-emerald-100 text-emerald-800"
                                    }`}
                                  >
                                    {participant.role}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {participant.tipo_identificacion ?? "-"}
                                </TableCell>
                                <TableCell>
                                  {participant.no_matricula ?? "-"}
                                </TableCell>
                                <TableCell>{participant.nombres}</TableCell>
                                <TableCell>{participant.apellidos}</TableCell>
                                <TableCell>
                                  {participant.grado ?? "-"}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() =>
                                      handleUnlinkSingle(
                                        participant.numero_identificacion,
                                      )
                                    }
                                    disabled={
                                      unlinkingParticipantId ===
                                      participant.numero_identificacion
                                    }
                                  >
                                    {unlinkingParticipantId ===
                                    participant.numero_identificacion ? (
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
                    <CardTitle className="text-lg">Gestión Masiva</CardTitle>
                    <CardDescription>
                      Vincule o desvincule múltiples participantes (estudiantes
                      y/o profesores) separados por comas.
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
                                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
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
                        name="participantIdsRaw"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Número de identificación de estudiante o profesor
                              (1 o muchos, separados por comas) *
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ej: 1021456789, 1033344455"
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
                        Identificaciones detectadas:{" "}
                        <span className="font-semibold">
                          {participantIds.length}
                        </span>
                      </p>
                      {isPreviewLoading ? (
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Validando participantes...
                        </p>
                      ) : previewMatches.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {previewMatches.map((item) => (
                            <span
                              key={item.numero_identificacion}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${roleClasses(
                                item.role,
                              )}`}
                            >
                              {item.numero_identificacion} -{" "}
                              {roleLabel(item.role)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 mt-1 break-all">
                          Sin identificaciones cargadas
                        </p>
                      )}
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
                          "Vincular Participantes al Curso"
                        ) : (
                          "Desvincular Participantes del Curso"
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
