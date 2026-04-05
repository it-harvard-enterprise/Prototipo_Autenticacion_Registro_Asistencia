"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ClipboardList, Fingerprint, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import {
  getAttendanceRosterByCourseAndDate,
  getCourseOptions,
  saveAttendanceForCourseAndDate,
  type AttendanceStudentRow,
  type FingerprintAttendanceMatch,
  type CourseOption,
} from "@/app/actions/attendance";
import { useDigitalPersonaFingerprintReader } from "@/lib/biometrics/digitalpersona";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const attendanceSchema = z.object({
  idCurso: z
    .string()
    .min(1, "Debe seleccionar un curso")
    .refine((value) => Number.isInteger(Number(value)) && Number(value) > 0, {
      message: "Seleccione un id_curso válido",
    }),
  fecha: z.string().min(1, "La fecha es requerida"),
});

type AttendanceFormValues = z.infer<typeof attendanceSchema>;
type SaldoValue = "cancelado" | "debe" | null;
type MetodoPagoValue =
  | "efectivo"
  | "transferencia"
  | "nequi"
  | "daviplata"
  | "otro"
  | null;

function createAttendanceTimestamp(selectedDate: string): string {
  const now = new Date();
  const [year, month, day] = selectedDate
    .split("-")
    .map((part) => Number(part));

  if (!year || !month || !day) {
    return now.toISOString();
  }

  const combined = new Date(
    year,
    month - 1,
    day,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );

  return combined.toISOString();
}

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AttendancePage() {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [students, setStudents] = useState<AttendanceStudentRow[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [hasLoadedRoster, setHasLoadedRoster] = useState(false);
  const [isCapturingFingerprint, setIsCapturingFingerprint] = useState(false);
  const [lastFingerprintMatch, setLastFingerprintMatch] = useState<{
    numero_identificacion: string;
    confidence?: number;
    source?: "backend" | "local";
  } | null>(null);

  const {
    ready: readerReady,
    deviceStatus,
    captureStatus,
    lastQuality,
    capture,
  } = useDigitalPersonaFingerprintReader();

  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceSchema),
    defaultValues: {
      idCurso: "",
      fecha: getTodayIsoDate(),
    },
  });

  const selectedCourseName = useMemo(() => {
    const currentId = Number(form.watch("idCurso"));
    if (!Number.isInteger(currentId)) return "";
    return (
      courses.find((course) => course.id_curso === currentId)?.nombre_curso ??
      ""
    );
  }, [courses, form]);

  const autosaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  async function persistAttendanceRowsInBackground(
    values: AttendanceFormValues,
    rowsToPersist: AttendanceStudentRow[],
  ) {
    if (rowsToPersist.length === 0) return;

    setIsAutoSaving(true);
    const result = await saveAttendanceForCourseAndDate({
      idCurso: Number(values.idCurso),
      date: values.fecha,
      rows: rowsToPersist.map((student) => ({
        numero_identificacion: student.numero_identificacion,
        asistio: student.asistio,
        saldo: student.saldo as SaldoValue,
        metodo_pago: student.metodo_pago as MetodoPagoValue,
        marcado_en: student.marcado_en,
      })),
    });
    setIsAutoSaving(false);

    if (!result.success) {
      toast.error(
        result.error ?? "No fue posible guardar el progreso de asistencia",
      );
    }
  }

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

  async function handleLoadRoster(
    values?: AttendanceFormValues,
  ): Promise<AttendanceStudentRow[] | null> {
    const parsed = values
      ? values
      : attendanceSchema.safeParse(form.getValues()).success
        ? (form.getValues() as AttendanceFormValues)
        : null;

    if (!parsed) {
      await form.trigger();
      return null;
    }

    const idCurso = Number(parsed.idCurso);

    setIsLoadingRoster(true);
    const result = await getAttendanceRosterByCourseAndDate(
      idCurso,
      parsed.fecha,
    );
    setIsLoadingRoster(false);

    if (!result.success) {
      setStudents([]);
      toast.error(
        result.error ?? "No fue posible cargar la lista de asistencia",
      );
      return null;
    }

    const rows = result.data ?? [];
    setStudents(rows);
    setHasLoadedRoster(true);
    toast.success("Lista de asistencia cargada");

    return rows;
  }

  async function handleCaptureFingerprintAttendance() {
    const parsed = attendanceSchema.safeParse(form.getValues());
    if (!parsed.success) {
      await form.trigger();
      return;
    }

    if (!readerReady) {
      toast.error(
        "El lector no esta listo. Verifique la conexion y el servicio de DigitalPersona.",
      );
      return;
    }

    const idCurso = Number(parsed.data.idCurso);
    setIsCapturingFingerprint(true);
    const template = (await capture("attendance"))?.trim() ?? "";
    setIsCapturingFingerprint(false);

    if (!template) {
      toast.error("No fue posible capturar la huella para validar asistencia");
      return;
    }

    let roster = students;
    if (roster.length === 0) {
      const loaded = await handleLoadRoster(parsed.data);
      roster = loaded ?? [];
    }

    if (roster.length === 0) {
      toast.error("No hay estudiantes asociados para este curso");
      return;
    }

    const identifyResponse = await fetch("/api/attendance/identify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idCurso,
        fingerprintTemplate: template,
      }),
    });

    const result =
      (await identifyResponse.json()) as FingerprintAttendanceMatch;

    if (!result.success) {
      toast.error(result.error ?? "No fue posible validar la huella");
      return;
    }

    if (!result.matched || !result.numero_identificacion) {
      toast.error(result.error ?? "No se encontró coincidencia de huella");
      return;
    }

    const matchedId = result.numero_identificacion;
    const matchedStudent = roster.find(
      (student) => student.numero_identificacion === matchedId,
    );

    if (!matchedStudent) {
      toast.error("La huella coincide con un estudiante fuera de este listado");
      return;
    }

    updateStudentAttendance(matchedId, { asistio: true });

    setLastFingerprintMatch({
      numero_identificacion: matchedId,
      confidence: result.confidence,
      source: result.source,
    });

    toast.success(
      `Asistencia marcada por huella: ${matchedStudent.apellidos}, ${matchedStudent.nombres}`,
    );
  }

  function updateStudentAttendance(
    numeroIdentificacion: string,
    patch: Partial<AttendanceStudentRow>,
  ) {
    const selectedDate = form.getValues("fecha");

    setStudents((prev) =>
      prev.map((student) => {
        if (student.numero_identificacion !== numeroIdentificacion) {
          return student;
        }

        const wasPresent = student.asistio;
        const next = { ...student, ...patch };

        if (!wasPresent && next.asistio) {
          next.marcado_en = createAttendanceTimestamp(selectedDate);
        }

        if (!next.asistio) {
          next.saldo = null;
          next.metodo_pago = null;
          next.marcado_en = null;
        } else if (next.saldo !== "cancelado") {
          next.metodo_pago = null;
        }

        return next;
      }),
    );
  }

  useEffect(() => {
    if (!hasLoadedRoster || students.length === 0) return;

    const parsed = attendanceSchema.safeParse(form.getValues());
    if (!parsed.success) return;

    if (autosaveDebounceRef.current) {
      clearTimeout(autosaveDebounceRef.current);
    }

    autosaveDebounceRef.current = setTimeout(() => {
      void persistAttendanceRowsInBackground(parsed.data, students);
    }, 450);

    return () => {
      if (autosaveDebounceRef.current) {
        clearTimeout(autosaveDebounceRef.current);
        autosaveDebounceRef.current = null;
      }
    };
  }, [hasLoadedRoster, students, form]);

  async function onSubmit(values: AttendanceFormValues) {
    if (students.length === 0) {
      toast.error("Primero cargue los estudiantes del curso");
      return;
    }

    for (const student of students) {
      if (student.asistio && !student.saldo) {
        toast.error(
          `Debe seleccionar saldo para ${student.nombres} ${student.apellidos}`,
        );
        return;
      }

      if (
        student.asistio &&
        student.saldo === "cancelado" &&
        !student.metodo_pago
      ) {
        toast.error(
          `Debe seleccionar metodo de pago para ${student.nombres} ${student.apellidos}`,
        );
        return;
      }
    }

    setIsSaving(true);
    const result = await saveAttendanceForCourseAndDate({
      idCurso: Number(values.idCurso),
      date: values.fecha,
      rows: students.map((student) => ({
        numero_identificacion: student.numero_identificacion,
        asistio: student.asistio,
        saldo: student.saldo as SaldoValue,
        metodo_pago: student.metodo_pago as MetodoPagoValue,
        marcado_en: student.marcado_en,
      })),
    });
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error ?? "No fue posible guardar la asistencia");
      return;
    }

    toast.success(
      `Asistencia guardada correctamente (${result.savedCount ?? students.length} registros)`,
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-[#b92f2d]/10 p-2">
          <ClipboardList className="h-5 w-5 text-[#b92f2d]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tomar Asistencia</h1>
          <p className="text-gray-500 mt-1">
            Seleccione curso y fecha para cargar estudiantes asociados y
            registrar asistencia.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtro de asistencia</CardTitle>
          <CardDescription>
            El selector de cursos se carga consultando id_curso y nombre_curso
            en la base de datos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-4 items-end">
                <FormField
                  control={form.control}
                  name="idCurso"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Curso (id_curso - nombre) *</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                          disabled={isLoadingCourses}
                        >
                          <option value="">
                            {isLoadingCourses
                              ? "Cargando cursos..."
                              : "Seleccione un curso"}
                          </option>
                          {courses.map((course) => (
                            <option
                              key={course.id_curso}
                              value={String(course.id_curso)}
                            >
                              {course.id_curso} - {course.nombre_curso}
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
                  name="fecha"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="button"
                  onClick={() => handleLoadRoster()}
                  disabled={isLoadingRoster || isLoadingCourses}
                  className="bg-[#b92f2d] hover:bg-[#982725] text-white"
                >
                  {isLoadingRoster ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cargando...
                    </>
                  ) : (
                    "Cargar Estudiantes"
                  )}
                </Button>
              </div>

              {selectedCourseName && (
                <div className="rounded-md border border-[#b92f2d]/20 bg-[#b92f2d]/5 p-3 text-sm text-[#982725]">
                  Curso seleccionado:{" "}
                  <span className="font-semibold">{selectedCourseName}</span>
                </div>
              )}

              {isAutoSaving && (
                <p className="text-xs text-gray-500">
                  Guardando progreso automaticamente...
                </p>
              )}

              <Card className="border-dashed border-[#b92f2d]/30 bg-[#b92f2d]/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-[#982725] flex items-center gap-2">
                    <Fingerprint className="h-4 w-4" />
                    Asistencia por huella
                  </CardTitle>
                  <CardDescription>
                    Captura de huellas digitales con el sensor DigitalPersona
                    U.are.U 4500 para autenticacion biometrica y marcado
                    automatico de asistencia.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-md border p-3 bg-white">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">
                        Lector
                      </p>
                      <p
                        className={`text-sm mt-1 ${
                          readerReady ? "text-green-700" : "text-[#982725]"
                        }`}
                      >
                        {deviceStatus}
                      </p>
                    </div>
                    <div className="rounded-md border p-3 bg-white">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">
                        Estado de captura
                      </p>
                      <p className="text-sm mt-1 text-gray-700">
                        {captureStatus}
                      </p>
                    </div>
                    {/* <div className="rounded-md border p-3 bg-white">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">
                        Calidad
                      </p>
                      <p className="text-sm mt-1 text-gray-700">
                        {typeof lastQuality === "number" ? lastQuality : "N/A"}
                      </p>
                    </div> */}
                  </div>

                  <Button
                    type="button"
                    onClick={handleCaptureFingerprintAttendance}
                    disabled={isCapturingFingerprint || isLoadingRoster}
                    className="bg-[#b92f2d] hover:bg-[#982725] text-white"
                  >
                    {isCapturingFingerprint ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Capturando y validando...
                      </>
                    ) : (
                      "Capturar y Marcar"
                    )}
                  </Button>

                  {lastFingerprintMatch && (
                    <p className="text-xs text-[#982725]">
                      Ultima coincidencia:{" "}
                      {lastFingerprintMatch.numero_identificacion}
                      {typeof lastFingerprintMatch.confidence === "number" &&
                        ` (confianza ${(lastFingerprintMatch.confidence * 100).toFixed(1)}%)`}
                      {lastFingerprintMatch.source &&
                        ` - fuente ${lastFingerprintMatch.source}`}
                    </p>
                  )}
                </CardContent>
              </Card>

              <div className="rounded-md border bg-white overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Estudiante</TableHead>
                      <TableHead>Asistencia</TableHead>
                      <TableHead>Saldo</TableHead>
                      <TableHead>Método de pago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-8 text-center text-gray-500"
                        >
                          Cargue un curso para ver estudiantes asociados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      students.map((student) => (
                        <TableRow key={student.numero_identificacion}>
                          <TableCell className="whitespace-normal">
                            <p className="font-medium text-gray-900">
                              {student.apellidos}, {student.nombres}
                            </p>
                            <p className="text-xs text-gray-500">
                              ID: {student.numero_identificacion}
                            </p>
                          </TableCell>
                          <TableCell>
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={student.asistio}
                                onChange={(event) =>
                                  updateStudentAttendance(
                                    student.numero_identificacion,
                                    { asistio: event.target.checked },
                                  )
                                }
                              />
                              Presente
                            </label>
                          </TableCell>
                          <TableCell>
                            <select
                              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-input/50"
                              value={student.saldo ?? ""}
                              disabled={!student.asistio}
                              onChange={(event) =>
                                updateStudentAttendance(
                                  student.numero_identificacion,
                                  {
                                    saldo: (event.target.value || null) as
                                      | "cancelado"
                                      | "debe"
                                      | null,
                                  },
                                )
                              }
                            >
                              <option value="">Seleccione</option>
                              <option value="cancelado">Cancelado</option>
                              <option value="debe">Debe</option>
                            </select>
                          </TableCell>
                          <TableCell>
                            <select
                              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-input/50"
                              value={student.metodo_pago ?? ""}
                              disabled={
                                !student.asistio ||
                                student.saldo !== "cancelado"
                              }
                              onChange={(event) =>
                                updateStudentAttendance(
                                  student.numero_identificacion,
                                  {
                                    metodo_pago: (event.target.value ||
                                      null) as
                                      | "efectivo"
                                      | "transferencia"
                                      | "nequi"
                                      | "daviplata"
                                      | "otro"
                                      | null,
                                  },
                                )
                              }
                            >
                              <option value="">Seleccione</option>
                              <option value="efectivo">Efectivo</option>
                              <option value="transferencia">
                                Transferencia
                              </option>
                              <option value="nequi">Nequi</option>
                              <option value="daviplata">Daviplata</option>
                              <option value="otro">Otro</option>
                            </select>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={students.length === 0 || isSaving}
                  className="bg-[#b92f2d] hover:bg-[#982725] text-white"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar Asistencia"
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
