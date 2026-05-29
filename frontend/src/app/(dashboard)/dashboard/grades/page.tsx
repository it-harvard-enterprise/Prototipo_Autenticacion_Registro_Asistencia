"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarClock,
  FolderOpen,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import {
  createAcademicPeriod,
  getAcademicPeriods,
  getGradesCourseOptions,
  type AcademicPeriod,
  type GradesPeriodsPayload,
} from "@/app/actions/grades";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const FUTURE_YEARS_WINDOW = 5;
const PERIOD_TERMS: Array<1 | 2> = [1, 2];

function toTermLabel(term: number): string {
  if (term === 1) {
    return "Periodo 1";
  }
  if (term === 2) {
    return "Periodo 2";
  }
  return `Periodo ${term}`;
}

function sortPeriods(periods: AcademicPeriod[]): AcademicPeriod[] {
  return [...periods].sort((a, b) => {
    if (a.period_year !== b.period_year) {
      return b.period_year - a.period_year;
    }
    return b.period_term - a.period_term;
  });
}

function buildYearWindow(fromYear: number): number[] {
  return Array.from(
    { length: FUTURE_YEARS_WINDOW + 1 },
    (_, index) => fromYear + index,
  );
}

function normalizeTerm(value: number): 1 | 2 {
  return value === 2 ? 2 : 1;
}

function periodKey(year: number, term: number): string {
  return `${year}-${term}`;
}

export default function GradesCoursesPage() {
  const generationWindowYears = useMemo(
    () => buildYearWindow(new Date().getFullYear()),
    [],
  );

  const [courses, setCourses] = useState<
    Array<{ id_curso: number; nombre_curso: string }>
  >([]);
  const [periodsPayload, setPeriodsPayload] =
    useState<GradesPeriodsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<number>(
    generationWindowYears[0],
  );
  const [selectedTerm, setSelectedTerm] = useState<1 | 2>(1);

  const yearOptions = useMemo(() => {
    const maxSelectableYear =
      generationWindowYears[generationWindowYears.length - 1];

    const years = new Set(
      (periodsPayload?.periods ?? [])
        .filter((period) => period.period_year <= maxSelectableYear)
        .map((period) => period.period_year),
    );

    for (const year of generationWindowYears) {
      years.add(year);
    }

    return Array.from(years).sort((a, b) => b - a);
  }, [periodsPayload, generationWindowYears]);

  useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);

      const [coursesResult, periodsResult] = await Promise.all([
        getGradesCourseOptions(),
        getAcademicPeriods(),
      ]);

      setIsLoading(false);

      if (!coursesResult.success) {
        toast.error(coursesResult.error ?? "No fue posible cargar cursos");
      } else {
        setCourses(coursesResult.data ?? []);
      }

      if (!periodsResult.success || !periodsResult.data) {
        toast.error(periodsResult.error ?? "No fue posible cargar periodos");
        return;
      }

      let payload = periodsResult.data;
      let sorted = sortPeriods(payload.periods);

      const existingPeriodKeys = new Set(
        sorted.map((period) =>
          periodKey(period.period_year, period.period_term),
        ),
      );

      const missingPeriods: Array<{ year: number; term: 1 | 2 }> = [];
      for (const year of generationWindowYears) {
        for (const term of PERIOD_TERMS) {
          const key = periodKey(year, term);
          if (!existingPeriodKeys.has(key)) {
            missingPeriods.push({ year, term });
          }
        }
      }

      if (missingPeriods.length > 0) {
        for (const missing of missingPeriods) {
          const createResult = await createAcademicPeriod({
            year: missing.year,
            term: missing.term,
          });

          if (!createResult.success) {
            toast.error(
              createResult.error ??
                `No fue posible crear el periodo ${missing.year}-${missing.term}`,
            );
          }
        }

        const refreshedPeriods = await getAcademicPeriods();
        if (refreshedPeriods.success && refreshedPeriods.data) {
          payload = refreshedPeriods.data;
          sorted = sortPeriods(payload.periods);
        } else {
          toast.error(
            refreshedPeriods.error ?? "No fue posible recargar periodos",
          );
        }
      }

      const selectedFromBackend =
        sorted.find((item) => item.id === payload.selected_period_id) ??
        sorted[0] ??
        null;

      if (selectedFromBackend) {
        setSelectedYear(selectedFromBackend.period_year);
        setSelectedTerm(normalizeTerm(selectedFromBackend.period_term));
      } else {
        setSelectedYear(generationWindowYears[0]);
        setSelectedTerm(1);
      }

      setPeriodsPayload({
        periods: sorted,
        selected_period_id: selectedFromBackend?.id ?? null,
      });
    }

    void loadInitialData();
  }, [generationWindowYears]);

  const selectedPeriod = useMemo(() => {
    return (
      periodsPayload?.periods.find(
        (period) =>
          period.period_year === selectedYear &&
          period.period_term === selectedTerm,
      ) ?? null
    );
  }, [periodsPayload, selectedYear, selectedTerm]);

  const filteredCourses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return courses;
    }

    return courses.filter((course) => {
      return (
        String(course.id_curso).includes(normalized) ||
        course.nombre_curso.toLowerCase().includes(normalized)
      );
    });
  }, [courses, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calificaciones</h1>
        <p className="mt-1 text-gray-500">
          Seleccione curso y periodo para gestionar desempeno, notas y
          boletines.
        </p>
      </div>

      <Card className="border-[#b92f2d]/20 bg-gradient-to-r from-[#fff7f7] to-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[#b92f2d]" />
            Periodo Academico Activo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Año</span>
              <select
                value={selectedYear}
                onChange={(event) =>
                  setSelectedYear(Number(event.target.value))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Periodo</span>
              <select
                value={selectedTerm}
                onChange={(event) =>
                  setSelectedTerm(normalizeTerm(Number(event.target.value)))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {PERIOD_TERMS.map((term) => (
                  <option key={term} value={term}>
                    {toTermLabel(term)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-md border border-[#b92f2d]/20 bg-white p-3 text-sm">
            {selectedPeriod ? (
              <>
                <p className="font-semibold text-gray-900">
                  Seleccionado: {selectedPeriod.period_label}
                </p>
                <p className="text-gray-600 mt-1">
                  Rango: {selectedPeriod.fecha_inicio} a{" "}
                  {selectedPeriod.fecha_fin}
                  {selectedPeriod.auto_generado ? " · Auto-generado" : ""}
                </p>
              </>
            ) : (
              <p className="text-[#982725] font-medium">
                No existe el periodo {selectedYear}-{selectedTerm}. Recargue la
                pagina para sincronizar periodos.
              </p>
            )}
          </div>

          <div className="rounded-md border border-dashed border-[#b92f2d]/20 bg-[#fffafb] p-3 text-xs text-[#7a2624]">
            <p className="font-semibold mb-1 flex items-center gap-1">
              <HelpCircle className="h-3.5 w-3.5" />
              Ayuda de periodos
            </p>
            <p>
              Los periodos se crean automaticamente para una ventana movil de
              anio actual + 5 anios ({generationWindowYears[0]} a{" "}
              {generationWindowYears[generationWindowYears.length - 1]}), con
              Periodo 1 y Periodo 2 por cada anio. Los anios historicos ya
              existentes tambien se mantienen en el selector.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#b92f2d]" />
            Cursos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Buscar por id o nombre del curso"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando informacion inicial...
            </div>
          ) : null}

          {!isLoading && filteredCourses.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              No hay cursos disponibles para mostrar.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map((course) => {
              const content = (
                <>
                  <div className="mb-3 flex items-start justify-between">
                    <span className="inline-flex rounded-full bg-[#b92f2d]/10 px-2 py-1 text-xs font-semibold text-[#982725]">
                      Curso #{course.id_curso}
                    </span>
                    <FolderOpen className="h-5 w-5 text-[#b92f2d] transition group-hover:scale-110" />
                  </div>
                  <h2 className="line-clamp-2 font-semibold text-gray-900">
                    {course.nombre_curso}
                  </h2>
                  <p className="mt-2 text-xs text-gray-500">
                    {selectedPeriod
                      ? `Abrir planilla para ${selectedPeriod.period_label}`
                      : "Debe seleccionar un periodo valido"}
                  </p>
                </>
              );

              if (!selectedPeriod) {
                return (
                  <div
                    key={course.id_curso}
                    className="group rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 opacity-80"
                  >
                    {content}
                  </div>
                );
              }

              return (
                <Link
                  key={course.id_curso}
                  href={`/dashboard/grades/${course.id_curso}?periodId=${selectedPeriod.id}`}
                  className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-[#b92f2d]/50 hover:shadow"
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
