"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
    .min(1, "Ingrese al menos un numero_identificacion"),
  idCurso: z
    .string()
    .min(1, "El id_curso es requerido")
    .refine((value) => Number.isInteger(Number(value)) && Number(value) > 0, {
      message: "Ingrese un id_curso valido",
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
  const [linkedParticipants, setLinkedParticipants] = useState<
    LinkedParticipantRow[]
  >([]);
  const [previewMatches, setPreviewMatches] = useState<
    Array<{ numero_identificacion: string; role: ParticipantRole }>
  >([]);
  const [isSearchingCourse, setIsSearchingCourse] = useState(false);
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
      form.setError("idCurso", { message: "Ingrese un id_curso valido" });
      return;
    }

    setIsSearchingCourse(true);
    const result = await getCourseById(idCurso);
    setIsSearchingCourse(false);

    if (!result.success || !result.data) {
      setCourse(null);
      setLinkedParticipants([]);
      toast.error(result.error ?? "No se encontro el curso");
      return;
    }

    setCourse(result.data);
    await loadLinkedParticipants(idCurso);
    toast.success("Curso encontrado");
  }

  async function handleUnlinkSingle(participantId: string) {
    if (!course) {
      toast.error("Primero busque y confirme un curso valido");
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
      toast.error("Primero busque y confirme un curso valido");
      return;
    }

    const ids = values.participantIdsRaw
      .split(",")
      .map((id) => id.trim().toUpperCase())
      .filter(Boolean);

    if (ids.length === 0) {
      toast.error("Ingrese al menos un numero_identificacion");
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
        `Asociacion completada: ${result.insertedCount ?? ids.length} participante(s) vinculados`,
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
        `Desvinculacion completada: ${result.removedCount ?? ids.length} participante(s) desvinculados`,
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
            Primero busque un curso por ID. Luego podra ver estudiantes y
            profesores, y gestionar su vinculacion o desvinculacion.
          </p>
        </div>
      </div>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Asociacion de participantes</CardTitle>
          <CardDescription>
            Busque un curso para habilitar las opciones de gestion.
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
                      Participantes del curso
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
                              <TableHead>Identificacion</TableHead>
                              <TableHead>Rol</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>No. Matricula</TableHead>
                              <TableHead>Nombres</TableHead>
                              <TableHead>Apellidos</TableHead>
                              <TableHead>Grado</TableHead>
                              <TableHead className="text-right">
                                Accion
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
                    <CardTitle className="text-lg">Gestion masiva</CardTitle>
                    <CardDescription>
                      Vincule o desvincule multiples participantes (estudiantes
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
                            <FormLabel>Operacion *</FormLabel>
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
                              Numero de identificacion de estudiante o profesor
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
