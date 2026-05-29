"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Download,
  Loader2,
  PenSquare,
  Save,
  Search,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
  getAcademicPeriods,
  saveGrades,
  updateProfessorSignature,
  type AcademicPeriod,
  type GradeRosterProfessor,
  type GradeStudentRow,
  type GradesRosterPayload,
} from "@/app/actions/grades";
import { matchesPeopleQuery } from "@/lib/people-search";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PerformanceView = "ingles" | "matematicas" | "sistemas" | "general";

type GradeNumericField =
  | "ingles_speaking_1"
  | "ingles_speaking_2"
  | "ingles_listening_1"
  | "ingles_listening_2"
  | "ingles_writing_1"
  | "ingles_writing_2"
  | "ingles_reading_1"
  | "ingles_reading_2"
  | "ingles_grammar_1"
  | "ingles_grammar_2"
  | "ingles_definitiva"
  | "matematicas_pro"
  | "matematicas_sol"
  | "matematicas_com"
  | "matematicas_raz"
  | "matematicas_definitiva"
  | "sistemas_definitiva";

type GradeTextField =
  | "ingles_comentarios_docente"
  | "matematicas_comentarios_docente"
  | "sistemas_notas_docente"
  | "comentarios_generales_docente";

type DefinitivaOverrideState = {
  ingles: boolean;
  matematicas: boolean;
};

const INGLES_COMPONENT_FIELDS = new Set<GradeNumericField>([
  "ingles_speaking_1",
  "ingles_speaking_2",
  "ingles_listening_1",
  "ingles_listening_2",
  "ingles_writing_1",
  "ingles_writing_2",
  "ingles_reading_1",
  "ingles_reading_2",
  "ingles_grammar_1",
  "ingles_grammar_2",
]);

const MATEMATICAS_COMPONENT_FIELDS = new Set<GradeNumericField>([
  "matematicas_pro",
  "matematicas_sol",
  "matematicas_com",
  "matematicas_raz",
]);

const VIEW_BUTTONS: Array<{ id: PerformanceView; label: string }> = [
  { id: "ingles", label: "Desempeño Inglés" },
  { id: "matematicas", label: "Desempeño Matemáticas" },
  { id: "sistemas", label: "Desempeño Sistemas" },
  {
    id: "general",
    label: "Notas/Comentarios generales del docente al estudiante",
  },
];

function toInputNumberValue(value: number | null): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function formatStudentFullName(student: GradeStudentRow): string {
  return `${student.apellidos}, ${student.nombres}`;
}

function parseFileNameFromDisposition(
  contentDisposition: string | null,
): string | null {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]).trim();
  }

  const simpleMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return simpleMatch?.[1]?.trim() || null;
}

function sortPeriods(periods: AcademicPeriod[]): AcademicPeriod[] {
  return [...periods].sort((a, b) => {
    if (a.period_year !== b.period_year) {
      return b.period_year - a.period_year;
    }
    return b.period_term - a.period_term;
  });
}

function asTermLabel(term: number): string {
  if (term === 1) {
    return "Periodo 1";
  }
  if (term === 2) {
    return "Periodo 2";
  }
  return `Periodo ${term}`;
}

function averageNullableGrades(
  values: Array<number | null | undefined>,
): number | null {
  const validValues = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );

  if (validValues.length === 0) {
    return null;
  }

  const total = validValues.reduce((sum, value) => sum + value, 0);
  return Math.round((total / validValues.length) * 100) / 100;
}

function calculateInglesDefinitiva(row: GradeStudentRow): number | null {
  return averageNullableGrades([
    row.ingles_speaking_1,
    row.ingles_speaking_2,
    row.ingles_listening_1,
    row.ingles_listening_2,
    row.ingles_writing_1,
    row.ingles_writing_2,
    row.ingles_reading_1,
    row.ingles_reading_2,
    row.ingles_grammar_1,
    row.ingles_grammar_2,
  ]);
}

function calculateMatematicasDefinitiva(row: GradeStudentRow): number | null {
  return averageNullableGrades([
    row.matematicas_pro,
    row.matematicas_sol,
    row.matematicas_com,
    row.matematicas_raz,
  ]);
}

async function fetchGradesRosterFromApi(params: {
  idCurso: number;
  periodId: number;
}): Promise<{
  success: boolean;
  error?: string;
  data?: GradesRosterPayload;
}> {
  const query = new URLSearchParams({
    id_curso: String(params.idCurso),
    period_id: String(params.periodId),
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`/api/grades/roster?${query.toString()}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      data?: GradesRosterPayload;
      error?: string;
    } | null;

    if (!response.ok || !payload?.success || !payload.data) {
      return {
        success: false,
        error: payload?.error ?? "No fue posible cargar la planilla de notas",
      };
    }

    return {
      success: true,
      data: payload.data,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        success: false,
        error: "Tiempo de espera agotado al cargar la planilla",
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function GradesDetailPage() {
  const params = useParams<{ idCurso: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const idCurso = Number(params.idCurso ?? 0);
  const periodIdFromQuery = Number(searchParams.get("periodId") ?? 0);

  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number>(0);
  const [courseInfo, setCourseInfo] = useState<
    GradesRosterPayload["course"] | null
  >(null);
  const [professor, setProfessor] = useState<GradeRosterProfessor | null>(null);
  const [students, setStudents] = useState<GradeStudentRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<PerformanceView>("ingles");

  const [isLoadingPeriods, setIsLoadingPeriods] = useState(true);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadingStudentId, setDownloadingStudentId] = useState<
    string | null
  >(null);
  const [isUpdatingSignature, setIsUpdatingSignature] = useState(false);
  const [definitivaOverrides, setDefinitivaOverrides] = useState<
    Record<string, DefinitivaOverrideState>
  >({});

  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedPeriod = useMemo(() => {
    return periods.find((period) => period.id === selectedPeriodId) ?? null;
  }, [periods, selectedPeriodId]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) {
      return students;
    }

    return students.filter((student) =>
      matchesPeopleQuery(searchQuery, {
        nombres: student.nombres,
        apellidos: student.apellidos,
        numero_identificacion: student.numero_identificacion,
      }),
    );
  }, [students, searchQuery]);

  async function loadPeriodsAndSelectOne() {
    setIsLoadingPeriods(true);
    const periodsResult = await getAcademicPeriods();
    setIsLoadingPeriods(false);

    if (!periodsResult.success || !periodsResult.data) {
      toast.error(periodsResult.error ?? "No fue posible cargar periodos");
      return;
    }

    const sorted = sortPeriods(periodsResult.data.periods);
    setPeriods(sorted);

    const fromQuery =
      Number.isInteger(periodIdFromQuery) && periodIdFromQuery > 0
        ? periodIdFromQuery
        : 0;

    const fallbackId =
      periodsResult.data.selected_period_id ?? sorted[0]?.id ?? 0;

    const finalSelected = sorted.some((item) => item.id === fromQuery)
      ? fromQuery
      : fallbackId;

    if (!finalSelected) {
      setSelectedPeriodId(0);
      return;
    }

    setSelectedPeriodId(finalSelected);
  }

  async function loadRoster(periodId: number) {
    if (!Number.isInteger(idCurso) || idCurso <= 0) {
      toast.error("Curso invalido");
      return;
    }

    if (!Number.isInteger(periodId) || periodId <= 0) {
      setStudents([]);
      return;
    }

    setIsLoadingRoster(true);
    const rosterResult = await fetchGradesRosterFromApi({
      idCurso,
      periodId,
    });

    if (!rosterResult.success || !rosterResult.data) {
      setStudents([]);
      setCourseInfo(null);
      setProfessor(null);
      setIsLoadingRoster(false);
      toast.error(rosterResult.error ?? "No fue posible cargar planilla");
      return;
    }

    setCourseInfo(rosterResult.data.course);
    setProfessor(rosterResult.data.professor ?? null);
    setStudents(rosterResult.data.students ?? []);
    setDefinitivaOverrides({});
    setIsDirty(false);
    setIsLoadingRoster(false);

    if ((rosterResult.data.students ?? []).length === 0) {
      toast.info("No hay estudiantes asociados a este curso en ese periodo");
    }
  }

  useEffect(() => {
    if (!Number.isInteger(idCurso) || idCurso <= 0) {
      toast.error("Curso invalido");
      return;
    }

    void loadPeriodsAndSelectOne();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCurso, periodIdFromQuery]);

  useEffect(() => {
    if (!selectedPeriodId || !Number.isInteger(idCurso) || idCurso <= 0) {
      return;
    }

    const currentPeriodInUrl = Number(searchParams.get("periodId") ?? 0);
    if (currentPeriodInUrl === selectedPeriodId) {
      return;
    }

    const query = new URLSearchParams(searchParams.toString());
    query.set("periodId", String(selectedPeriodId));
    router.replace(`/dashboard/grades/${idCurso}?${query.toString()}`);
  }, [idCurso, router, searchParams, selectedPeriodId]);

  useEffect(() => {
    if (!selectedPeriodId || !Number.isInteger(idCurso) || idCurso <= 0) {
      return;
    }

    void loadRoster(selectedPeriodId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCurso, selectedPeriodId]);

  useEffect(() => {
    if (!isDirty || students.length === 0 || !selectedPeriodId || isSaving) {
      return;
    }

    if (autosaveRef.current) {
      clearTimeout(autosaveRef.current);
    }

    autosaveRef.current = setTimeout(() => {
      void (async () => {
        setIsAutoSaving(true);
        const result = await saveGrades({
          id_curso: idCurso,
          period_id: selectedPeriodId,
          rows: students,
          update_definitivas: false,
        });
        setIsAutoSaving(false);

        if (!result.success) {
          toast.error(
            result.error ?? "No fue posible guardar progreso de calificaciones",
          );
          return;
        }

        setIsDirty(false);
      })();
    }, 700);

    return () => {
      if (autosaveRef.current) {
        clearTimeout(autosaveRef.current);
        autosaveRef.current = null;
      }
    };
  }, [students, isDirty, selectedPeriodId, isSaving, idCurso]);

  function patchStudentRow(
    numeroIdentificacion: string,
    patch: Partial<GradeStudentRow>,
  ) {
    setStudents((prev) =>
      prev.map((row) => {
        if (row.numero_identificacion !== numeroIdentificacion) {
          return row;
        }
        return { ...row, ...patch };
      }),
    );
    setIsDirty(true);
  }

  function updateNumericField(
    numeroIdentificacion: string,
    field: GradeNumericField,
    rawValue: string,
  ) {
    const trimmedValue = rawValue.trim();

    let normalizedValue: number | null = null;
    if (trimmedValue) {
      const parsed = Number(trimmedValue);
      if (!Number.isFinite(parsed)) {
        return;
      }

      const rounded = Math.round(parsed * 100) / 100;
      if (rounded < 0 || rounded > 5) {
        toast.error("Las notas deben estar entre 0.0 y 5.0");
        return;
      }

      normalizedValue = rounded;
    }

    const currentOverrides = definitivaOverrides[numeroIdentificacion] ?? {
      ingles: false,
      matematicas: false,
    };

    const nextOverrides: DefinitivaOverrideState = {
      ...currentOverrides,
      ingles:
        field === "ingles_definitiva"
          ? trimmedValue.length > 0
          : currentOverrides.ingles,
      matematicas:
        field === "matematicas_definitiva"
          ? trimmedValue.length > 0
          : currentOverrides.matematicas,
    };

    setDefinitivaOverrides((prev) => ({
      ...prev,
      [numeroIdentificacion]: nextOverrides,
    }));

    setStudents((prev) =>
      prev.map((row) => {
        if (row.numero_identificacion !== numeroIdentificacion) {
          return row;
        }

        const nextRow = {
          ...row,
          [field]: normalizedValue,
        } as GradeStudentRow;

        if (field === "ingles_definitiva" && !nextOverrides.ingles) {
          nextRow.ingles_definitiva = calculateInglesDefinitiva(nextRow);
        }

        if (field === "matematicas_definitiva" && !nextOverrides.matematicas) {
          nextRow.matematicas_definitiva =
            calculateMatematicasDefinitiva(nextRow);
        }

        if (INGLES_COMPONENT_FIELDS.has(field) && !nextOverrides.ingles) {
          nextRow.ingles_definitiva = calculateInglesDefinitiva(nextRow);
        }

        if (
          MATEMATICAS_COMPONENT_FIELDS.has(field) &&
          !nextOverrides.matematicas
        ) {
          nextRow.matematicas_definitiva =
            calculateMatematicasDefinitiva(nextRow);
        }

        return nextRow;
      }),
    );

    setIsDirty(true);
  }

  function updateTextField(
    numeroIdentificacion: string,
    field: GradeTextField,
    value: string,
  ) {
    patchStudentRow(numeroIdentificacion, {
      [field]: value,
    });
  }

  async function handleSaveManual() {
    if (students.length === 0 || !selectedPeriodId) {
      toast.error("No hay datos para guardar");
      return;
    }

    if (autosaveRef.current) {
      clearTimeout(autosaveRef.current);
      autosaveRef.current = null;
    }

    setIsSaving(true);
    const result = await saveGrades({
      id_curso: idCurso,
      period_id: selectedPeriodId,
      rows: students,
      update_definitivas: true,
    });
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error ?? "No fue posible guardar calificaciones");
      return;
    }

    setIsDirty(false);
    toast.success(
      `Calificaciones guardadas (${result.savedCount ?? students.length} registros)`,
    );
    await loadRoster(selectedPeriodId);
  }

  async function triggerPdfDownload(numeroIdentificacion?: string) {
    if (!selectedPeriodId) {
      toast.error("Seleccione un periodo academico valido");
      return;
    }

    const query = new URLSearchParams({
      id_curso: String(idCurso),
      period_id: String(selectedPeriodId),
    });

    if (numeroIdentificacion) {
      query.set("numero_identificacion", numeroIdentificacion);
      setDownloadingStudentId(numeroIdentificacion);
    } else {
      setIsDownloadingAll(true);
    }

    try {
      const response = await fetch(`/api/grades/report?${query.toString()}`, {
        method: "GET",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "No fue posible generar el boletin");
      }

      const blob = await response.blob();
      const fileName =
        parseFileNameFromDisposition(
          response.headers.get("content-disposition"),
        ) ??
        (numeroIdentificacion
          ? `boletin-${numeroIdentificacion}.pdf`
          : `boletin-curso-${idCurso}.pdf`);

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      toast.success("Boletin generado correctamente");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setIsDownloadingAll(false);
      setDownloadingStudentId(null);
    }
  }

  async function handleSignatureUpload(file: File | null) {
    if (!file || !professor?.numero_identificacion) {
      return;
    }

    if (file.size > 1024 * 1024) {
      toast.error("La firma no debe superar 1 MB");
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
      reader.readAsDataURL(file);
    }).catch(() => "");

    if (!dataUrl.startsWith("data:image/")) {
      toast.error("Seleccione una imagen valida para la firma");
      return;
    }

    setIsUpdatingSignature(true);
    const result = await updateProfessorSignature({
      numeroIdentificacion: professor.numero_identificacion,
      signatureDataUrl: dataUrl,
    });
    setIsUpdatingSignature(false);

    if (!result.success) {
      toast.error(result.error ?? "No fue posible actualizar la firma");
      return;
    }

    setProfessor((prev) =>
      prev
        ? {
            ...prev,
            firma_docente_data_url: dataUrl,
          }
        : prev,
    );

    toast.success("Firma docente actualizada");
  }

  async function handleClearSignature() {
    if (!professor?.numero_identificacion) {
      return;
    }

    setIsUpdatingSignature(true);
    const result = await updateProfessorSignature({
      numeroIdentificacion: professor.numero_identificacion,
      signatureDataUrl: null,
    });
    setIsUpdatingSignature(false);

    if (!result.success) {
      toast.error(result.error ?? "No fue posible limpiar la firma");
      return;
    }

    setProfessor((prev) =>
      prev
        ? {
            ...prev,
            firma_docente_data_url: null,
          }
        : prev,
    );

    toast.success("Firma docente eliminada");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/grades">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Planilla de Calificaciones
          </h1>
          <p className="mt-1 text-gray-500">
            Curso #{idCurso}
            {courseInfo?.nombre_curso ? ` - ${courseInfo.nombre_curso}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => void triggerPdfDownload()}
            disabled={
              isLoadingRoster || students.length === 0 || isDownloadingAll
            }
          >
            {isDownloadingAll ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generando PDF...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Boletin de todo el curso
              </>
            )}
          </Button>

          <Button
            type="button"
            onClick={handleSaveManual}
            disabled={isLoadingRoster || students.length === 0 || isSaving}
            className="bg-[#b92f2d] hover:bg-[#982725] text-white"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar calificaciones
              </>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Periodo academico</CardTitle>
          <CardDescription>
            La planilla se actualiza automaticamente en segundo plano y el
            guardado manual consolida definitivas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoadingPeriods ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando periodos...
            </div>
          ) : null}

          {!isLoadingPeriods ? (
            <select
              value={selectedPeriodId > 0 ? selectedPeriodId : ""}
              onChange={(event) =>
                setSelectedPeriodId(Number(event.target.value))
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Seleccione periodo
              </option>
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.period_label} ({period.fecha_inicio} a{" "}
                  {period.fecha_fin})
                </option>
              ))}
            </select>
          ) : null}

          <div className="text-xs text-gray-600">
            {selectedPeriod
              ? `Periodo activo: ${selectedPeriod.period_label} · ${asTermLabel(selectedPeriod.period_term)}`
              : "Seleccione un periodo para cargar estudiantes"}
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-600">
            <PenSquare className="h-3.5 w-3.5" />
            {isAutoSaving
              ? "Guardando progreso en segundo plano..."
              : isDirty
                ? "Cambios pendientes por guardar"
                : "Sin cambios pendientes"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Firma del docente</CardTitle>
          <CardDescription>
            Esta firma se utiliza automaticamente en el Boletin Academico PDF.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {professor ? (
            <>
              <p className="text-sm text-gray-700">
                Docente: {professor.apellidos}, {professor.nombres} (
                {professor.numero_identificacion})
              </p>

              {professor.firma_docente_data_url ? (
                <Image
                  src={professor.firma_docente_data_url}
                  alt="Firma docente"
                  width={280}
                  height={96}
                  unoptimized
                  className="h-24 w-auto rounded border bg-white p-2"
                />
              ) : (
                <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-600">
                  El docente no tiene firma registrada.
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-gray-50">
                  <Upload className="mr-2 h-4 w-4" />
                  {isUpdatingSignature
                    ? "Procesando..."
                    : "Subir/actualizar firma"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={isUpdatingSignature}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      void handleSignatureUpload(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClearSignature}
                  disabled={
                    isUpdatingSignature || !professor.firma_docente_data_url
                  }
                >
                  Limpiar firma
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-600">
              No se encontro docente asociado al curso.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vista de desempeño</CardTitle>
          <CardDescription>
            Cambie entre las vistas de Inglés, Matemáticas, Sistemas y
            comentarios generales.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {VIEW_BUTTONS.map((view) => (
              <Button
                key={view.id}
                type="button"
                size="sm"
                variant={activeView === view.id ? "default" : "outline"}
                className={
                  activeView === view.id
                    ? "bg-[#b92f2d] hover:bg-[#982725]"
                    : ""
                }
                onClick={() => setActiveView(view.id)}
              >
                {view.label}
              </Button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar por nombres, apellidos o identificacion"
              className="pl-9"
            />
          </div>

          <p className="text-sm text-gray-600">
            Mostrando {filteredStudents.length} de {students.length}{" "}
            estudiantes.
          </p>

          {isLoadingRoster ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando planilla...
            </div>
          ) : null}

          {!isLoadingRoster && filteredStudents.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              No hay registros para mostrar en esta vista.
            </div>
          ) : null}

          {!isLoadingRoster && filteredStudents.length > 0 ? (
            <div className="rounded-lg border border-gray-200 overflow-auto">
              <Table className="text-xs [&_th]:text-[11px] [&_th]:font-semibold [&_th]:whitespace-normal [&_th]:leading-tight [&_input]:h-8 [&_input]:w-16 [&_input]:text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Identificación</TableHead>
                    <TableHead>Estudiante</TableHead>
                    {activeView === "ingles" ? (
                      <>
                        <TableHead>Speaking 1</TableHead>
                        <TableHead>Speaking 2</TableHead>
                        <TableHead>Listening 1</TableHead>
                        <TableHead>Listening 2</TableHead>
                        <TableHead>Writing 1</TableHead>
                        <TableHead>Writing 2</TableHead>
                        <TableHead>Reading 1</TableHead>
                        <TableHead>Reading 2</TableHead>
                        <TableHead>Grammar 1</TableHead>
                        <TableHead>Grammar 2</TableHead>
                        <TableHead>Definitiva</TableHead>
                        <TableHead>Comentario docente</TableHead>
                      </>
                    ) : null}

                    {activeView === "matematicas" ? (
                      <>
                        <TableHead>PRO</TableHead>
                        <TableHead>SOL</TableHead>
                        <TableHead>COM</TableHead>
                        <TableHead>RAZ</TableHead>
                        <TableHead>Definitiva</TableHead>
                        <TableHead>Comentario docente</TableHead>
                      </>
                    ) : null}

                    {activeView === "sistemas" ? (
                      <>
                        <TableHead>Definitiva</TableHead>
                        <TableHead>Comentario docente</TableHead>
                      </>
                    ) : null}

                    {activeView === "general" ? (
                      <>
                        <TableHead>Comentarios generales del docente</TableHead>
                      </>
                    ) : null}

                    <TableHead>Boletin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.numero_identificacion}>
                      <TableCell className="font-mono text-xs">
                        {student.numero_identificacion}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatStudentFullName(student)}
                      </TableCell>

                      {activeView === "ingles" ? (
                        <>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={toInputNumberValue(
                                student.ingles_speaking_1,
                              )}
                              onChange={(event) =>
                                updateNumericField(
                                  student.numero_identificacion,
                                  "ingles_speaking_1",
                                  event.target.value,
                                )
                              }
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={toInputNumberValue(
                                student.ingles_speaking_2,
                              )}
                              onChange={(event) =>
                                updateNumericField(
                                  student.numero_identificacion,
                                  "ingles_speaking_2",
                                  event.target.value,
                                )
                              }
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={toInputNumberValue(
                                student.ingles_listening_1,
                              )}
                              onChange={(event) =>
                                updateNumericField(
                                  student.numero_identificacion,
                                  "ingles_listening_1",
                                  event.target.value,
                                )
                              }
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={toInputNumberValue(
                                student.ingles_listening_2,
                              )}
                              onChange={(event) =>
                                updateNumericField(
                                  student.numero_identificacion,
                                  "ingles_listening_2",
                                  event.target.value,
                                )
                              }
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={toInputNumberValue(
                                student.ingles_writing_1,
                              )}
                              onChange={(event) =>
                                updateNumericField(
                                  student.numero_identificacion,
                                  "ingles_writing_1",
                                  event.target.value,
                                )
                              }
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={toInputNumberValue(
                                student.ingles_writing_2,
                              )}
                              onChange={(event) =>
                                updateNumericField(
                                  student.numero_identificacion,
                                  "ingles_writing_2",
                                  event.target.value,
                                )
                              }
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={toInputNumberValue(
                                student.ingles_reading_1,
                              )}
                              onChange={(event) =>
                                updateNumericField(
                                  student.numero_identificacion,
                                  "ingles_reading_1",
                                  event.target.value,
                                )
                              }
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={toInputNumberValue(
                                student.ingles_reading_2,
                              )}
                              onChange={(event) =>
                                updateNumericField(
                                  student.numero_identificacion,
                                  "ingles_reading_2",
                                  event.target.value,
                                )
                              }
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={toInputNumberValue(
                                student.ingles_grammar_1,
                              )}
                              onChange={(event) =>
                                updateNumericField(
                                  student.numero_identificacion,
                                  "ingles_grammar_1",
                                  event.target.value,
                                )
                              }
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={toInputNumberValue(
                                student.ingles_grammar_2,
                              )}
                              onChange={(event) =>
                                updateNumericField(
                                  student.numero_identificacion,
                                  "ingles_grammar_2",
                                  event.target.value,
                                )
                              }
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={toInputNumberValue(
                                student.ingles_definitiva,
                              )}
                              onChange={(event) =>
                                updateNumericField(
                                  student.numero_identificacion,
                                  "ingles_definitiva",
                                  event.target.value,
                                )
                              }
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Textarea
                              value={student.ingles_comentarios_docente ?? ""}
                              onChange={(event) =>
                                updateTextField(
                                  student.numero_identificacion,
                                  "ingles_comentarios_docente",
                                  event.target.value,
                                )
                              }
                              className="min-w-52"
                            />
                          </TableCell>
                        </>
                      ) : null}

                      {activeView === "matematicas" ? (
                        <>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={toInputNumberValue(
                                student.matematicas_pro,
                              )}
                              onChange={(event) =>
                                updateNumericField(
                                  student.numero_identificacion,
                                  "matematicas_pro",
                                  event.target.value,
                                )
                              }
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={toInputNumberValue(
                                student.matematicas_sol,
                              )}
                              onChange={(event) =>
                                updateNumericField(
                                  student.numero_identificacion,
                                  "matematicas_sol",
                                  event.target.value,
                                )
                              }
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={toInputNumberValue(
                                student.matematicas_com,
                              )}
                              onChange={(event) =>
                                updateNumericField(
                                  student.numero_identificacion,
                                  "matematicas_com",
                                  event.target.value,
                                )
                              }
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={toInputNumberValue(
                                student.matematicas_raz,
                              )}
                              onChange={(event) =>
                                updateNumericField(
                                  student.numero_identificacion,
                                  "matematicas_raz",
                                  event.target.value,
                                )
                              }
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={toInputNumberValue(
                                student.matematicas_definitiva,
                              )}
                              onChange={(event) =>
                                updateNumericField(
                                  student.numero_identificacion,
                                  "matematicas_definitiva",
                                  event.target.value,
                                )
                              }
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Textarea
                              value={
                                student.matematicas_comentarios_docente ?? ""
                              }
                              onChange={(event) =>
                                updateTextField(
                                  student.numero_identificacion,
                                  "matematicas_comentarios_docente",
                                  event.target.value,
                                )
                              }
                              className="min-w-52"
                            />
                          </TableCell>
                        </>
                      ) : null}

                      {activeView === "sistemas" ? (
                        <>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={toInputNumberValue(
                                student.sistemas_definitiva,
                              )}
                              onChange={(event) =>
                                updateNumericField(
                                  student.numero_identificacion,
                                  "sistemas_definitiva",
                                  event.target.value,
                                )
                              }
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Textarea
                              value={student.sistemas_notas_docente ?? ""}
                              onChange={(event) =>
                                updateTextField(
                                  student.numero_identificacion,
                                  "sistemas_notas_docente",
                                  event.target.value,
                                )
                              }
                              className="min-w-72"
                            />
                          </TableCell>
                        </>
                      ) : null}

                      {activeView === "general" ? (
                        <>
                          <TableCell>
                            <Textarea
                              value={
                                student.comentarios_generales_docente ?? ""
                              }
                              onChange={(event) =>
                                updateTextField(
                                  student.numero_identificacion,
                                  "comentarios_generales_docente",
                                  event.target.value,
                                )
                              }
                              className="min-w-96"
                            />
                          </TableCell>
                        </>
                      ) : null}

                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void triggerPdfDownload(
                              student.numero_identificacion,
                            )
                          }
                          disabled={
                            downloadingStudentId ===
                            student.numero_identificacion
                          }
                        >
                          {downloadingStudentId ===
                          student.numero_identificacion ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Generando...
                            </>
                          ) : (
                            <>
                              <Download className="mr-2 h-4 w-4" />
                              PDF
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
