"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";
import { toast } from "sonner";

import { StudentsTable } from "@/components/students-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getStudentsByCourseId } from "@/app/actions/courses";
import { matchesPeopleQuery } from "@/lib/people-search";
import { cn } from "@/lib/utils";
import { Course, Student } from "@/lib/types";

interface StudentsDashboardContentProps {
  students: Student[];
  courses: Course[];
}

interface AppliedFilters {
  grado: string;
  tipoIdentificacion: string;
  coordinadorAcademico: string;
  /** id_curso seleccionado, o "" para todos */
  idCurso: string;
}

const EMPTY_FILTERS: AppliedFilters = {
  grado: "",
  tipoIdentificacion: "",
  coordinadorAcademico: "",
  idCurso: "",
};

type AttendanceBucketId = "all" | "low" | "mid" | "high" | "top";

interface AttendanceBucket {
  id: AttendanceBucketId;
  label: string;
  /** rango inclusive. Para `all` ambos son null. */
  min: number | null;
  max: number | null;
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(values.map((value) => (value ?? "").trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

function roundUpTo5(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.ceil(value / 5) * 5;
}

/**
 * Calcula los buckets de asistencia a partir del máximo observado en
 * la lista. Si todos los estudiantes tienen 0 asistencias, devolvemos
 * sólo "Todos". Si el máximo es muy bajo, colapsamos a 2 chips.
 */
function buildAttendanceBuckets(
  attendedCounts: number[],
): AttendanceBucket[] {
  const max = attendedCounts.reduce(
    (acc, count) => (count > acc ? count : acc),
    0,
  );

  if (max <= 0) {
    return [{ id: "all", label: "Todos", min: null, max: null }];
  }

  if (max < 5) {
    return [
      { id: "all", label: "Todos", min: null, max: null },
      { id: "low", label: "Sin asistencias (0)", min: 0, max: 0 },
      { id: "top", label: `Con asistencias (1+)`, min: 1, max: null },
    ];
  }

  const q1 = Math.max(5, roundUpTo5(max * 0.25));
  const q2 = Math.max(q1 + 5, roundUpTo5(max * 0.5));
  const q3 = Math.max(q2 + 5, roundUpTo5(max * 0.75));

  return [
    { id: "all", label: "Todos", min: null, max: null },
    { id: "low", label: `Pocas (0–${q1})`, min: 0, max: q1 },
    { id: "mid", label: `Moderadas (${q1 + 1}–${q2})`, min: q1 + 1, max: q2 },
    { id: "high", label: `Activas (${q2 + 1}–${q3})`, min: q2 + 1, max: q3 },
    { id: "top", label: `Muchas (${q3 + 1}+)`, min: q3 + 1, max: null },
  ];
}

function bucketMatches(bucket: AttendanceBucket, count: number): boolean {
  if (bucket.min === null && bucket.max === null) return true;
  if (bucket.min !== null && count < bucket.min) return false;
  if (bucket.max !== null && count > bucket.max) return false;
  return true;
}

export function StudentsDashboardContent({
  students,
  courses,
}: StudentsDashboardContentProps) {
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [draftFilters, setDraftFilters] =
    useState<AppliedFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<AppliedFilters>(EMPTY_FILTERS);
  const [activeBucketId, setActiveBucketId] = useState<AttendanceBucketId>(
    "all",
  );

  // Cache local de estudiantes por curso para no re-fetchear si el admin
  // alterna entre cursos: { [id_curso]: Set<numero_identificacion> }.
  const [studentsByCourse, setStudentsByCourse] = useState<
    Record<string, Set<string>>
  >({});
  const [loadingCourseId, setLoadingCourseId] = useState<string | null>(null);

  const gradeOptions = useMemo(
    () => uniqueSorted(students.map((student) => student.grado)),
    [students],
  );

  const identificationTypeOptions = useMemo(
    () => uniqueSorted(students.map((student) => student.tipo_identificacion)),
    [students],
  );

  const coordinatorOptions = useMemo(
    () =>
      uniqueSorted(students.map((student) => student.coordinador_academico)),
    [students],
  );

  const courseOptions = useMemo(
    () =>
      [...courses].sort((a, b) =>
        (a.nombre_curso ?? "").localeCompare(b.nombre_curso ?? "", "es", {
          sensitivity: "base",
        }),
      ),
    [courses],
  );

  // Los buckets se calculan una vez por dataset (no por filtro) para que
  // los rangos no salten cuando el admin filtra.
  const attendanceBuckets = useMemo(
    () =>
      buildAttendanceBuckets(
        students.map((student) => student.attended_count ?? 0),
      ),
    [students],
  );

  // Si el bucket activo deja de existir (porque cambió el dataset),
  // resetear a "Todos".
  useEffect(() => {
    if (!attendanceBuckets.some((bucket) => bucket.id === activeBucketId)) {
      setActiveBucketId("all");
    }
  }, [attendanceBuckets, activeBucketId]);

  const activeBucket =
    attendanceBuckets.find((bucket) => bucket.id === activeBucketId) ??
    attendanceBuckets[0];

  // Lazy-load la matrícula del curso seleccionado.
  useEffect(() => {
    const idCurso = appliedFilters.idCurso;
    if (!idCurso) return;
    if (studentsByCourse[idCurso]) return;
    if (loadingCourseId === idCurso) return;

    const numericId = Number(idCurso);
    if (!Number.isInteger(numericId) || numericId <= 0) return;

    let cancelled = false;
    setLoadingCourseId(idCurso);
    void (async () => {
      const result = await getStudentsByCourseId(numericId);
      if (cancelled) return;
      setLoadingCourseId(null);

      if (!result.success) {
        toast.error(
          result.error ?? "No fue posible cargar los estudiantes del curso",
        );
        // Cachear como vacío para evitar bucle de re-fetch; el admin puede
        // cambiar de curso y volver.
        setStudentsByCourse((prev) => ({
          ...prev,
          [idCurso]: new Set(),
        }));
        return;
      }

      const enrolled = new Set<string>(
        (result.data ?? [])
          .map((row) => (row.numero_identificacion ?? "").trim().toUpperCase())
          .filter(Boolean),
      );
      setStudentsByCourse((prev) => ({ ...prev, [idCurso]: enrolled }));
    })();

    return () => {
      cancelled = true;
    };
  }, [appliedFilters.idCurso, studentsByCourse, loadingCourseId]);

  const filteredStudents = useMemo(() => {
    const enrolledSet =
      appliedFilters.idCurso && studentsByCourse[appliedFilters.idCurso]
        ? studentsByCourse[appliedFilters.idCurso]
        : null;
    const filterByCourse = Boolean(appliedFilters.idCurso);

    return students.filter((student) => {
      const matchesSearch = matchesPeopleQuery(appliedSearch, {
        nombres: student.nombres,
        apellidos: student.apellidos,
        numero_identificacion: student.numero_identificacion,
      });

      const matchesGrade =
        !appliedFilters.grado || student.grado === appliedFilters.grado;

      const matchesIdType =
        !appliedFilters.tipoIdentificacion ||
        student.tipo_identificacion === appliedFilters.tipoIdentificacion;

      const matchesCoordinator =
        !appliedFilters.coordinadorAcademico ||
        student.coordinador_academico === appliedFilters.coordinadorAcademico;

      const matchesCourse = filterByCourse
        ? enrolledSet
          ? enrolledSet.has(
              (student.numero_identificacion ?? "").trim().toUpperCase(),
            )
          : false // mientras carga el curso, ocultamos hasta que llegue
        : true;

      const matchesAttendance = activeBucket
        ? bucketMatches(activeBucket, student.attended_count ?? 0)
        : true;

      return (
        matchesSearch &&
        matchesGrade &&
        matchesIdType &&
        matchesCoordinator &&
        matchesCourse &&
        matchesAttendance
      );
    });
  }, [
    students,
    appliedSearch,
    appliedFilters,
    studentsByCourse,
    activeBucket,
  ]);

  const hasAppliedFilters =
    appliedSearch.trim().length > 0 ||
    appliedFilters.grado.length > 0 ||
    appliedFilters.tipoIdentificacion.length > 0 ||
    appliedFilters.coordinadorAcademico.length > 0 ||
    appliedFilters.idCurso.length > 0 ||
    activeBucketId !== "all";

  function applySearch() {
    setAppliedSearch(searchInput.trim());
  }

  function clearAllFilters() {
    setSearchInput("");
    setAppliedSearch("");
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setActiveBucketId("all");
  }

  function openFilterDialog() {
    setDraftFilters(appliedFilters);
    setIsFilterDialogOpen(true);
  }

  function applyAdvancedFilters() {
    setAppliedFilters(draftFilters);
    setIsFilterDialogOpen(false);
  }

  const isLoadingCourseFilter =
    appliedFilters.idCurso !== "" && loadingCourseId === appliedFilters.idCurso;

  if (students.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg font-medium">No hay estudiantes registrados</p>
        <p className="text-sm mt-1">
          Haga clic en &quot;Nuevo Estudiante&quot; para agregar uno.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-white p-4">
        <p className="text-sm font-medium text-gray-800 mb-3">
          Buscar estudiante por nombre, apellidos, número de identificación o
          no. matrícula
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Ej: Juan Pérez, Cañón, 1234567890..."
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applySearch();
              }
            }}
          />
          <Button type="button" onClick={applySearch}>
            <Search className="mr-2 h-4 w-4" />
            Buscar
          </Button>
          <Button type="button" variant="outline" onClick={openFilterDialog}>
            <Filter className="mr-2 h-4 w-4" />
            Filtrar
          </Button>
          {hasAppliedFilters && (
            <Button type="button" variant="ghost" onClick={clearAllFilters}>
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {attendanceBuckets.length > 1 && (
        <div className="rounded-md border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
            Filtrar por clases asistidas
          </p>
          <div className="flex flex-wrap gap-2">
            {attendanceBuckets.map((bucket) => {
              const isActive = bucket.id === activeBucketId;
              return (
                <button
                  key={bucket.id}
                  type="button"
                  onClick={() => setActiveBucketId(bucket.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    isActive
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100",
                  )}
                  aria-pressed={isActive}
                >
                  {bucket.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-sm text-gray-600">
        Mostrando {filteredStudents.length} de {students.length} estudiantes
        {isLoadingCourseFilter ? " (cargando matrícula del curso…)" : ""}
      </p>

      {filteredStudents.length > 0 ? (
        <StudentsTable students={filteredStudents} />
      ) : (
        <div className="rounded-md border bg-white p-8 text-center text-gray-600">
          No hay estudiantes que coincidan con los filtros seleccionados.
        </div>
      )}

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filtrar estudiantes</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="filter-grado">Grado</Label>
              <select
                id="filter-grado"
                value={draftFilters.grado}
                onChange={(event) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    grado: event.target.value,
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {gradeOptions.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-id-type">Tipo de identificación</Label>
              <select
                id="filter-id-type"
                value={draftFilters.tipoIdentificacion}
                onChange={(event) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    tipoIdentificacion: event.target.value,
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {identificationTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-coordinator">Coordinador académico</Label>
              <select
                id="filter-coordinator"
                value={draftFilters.coordinadorAcademico}
                onChange={(event) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    coordinadorAcademico: event.target.value,
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {coordinatorOptions.map((coordinator) => (
                  <option key={coordinator} value={coordinator}>
                    {coordinator}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-course">Curso</Label>
              <select
                id="filter-course"
                value={draftFilters.idCurso}
                onChange={(event) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    idCurso: event.target.value,
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {courseOptions.map((course) => (
                  <option key={course.id_curso} value={String(course.id_curso)}>
                    {course.nombre_curso}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDraftFilters(EMPTY_FILTERS)}
            >
              Limpiar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFilterDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={applyAdvancedFilters}>
              Aplicar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
