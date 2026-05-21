"use client";

import { useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";

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
import { Student } from "@/lib/types";

interface StudentsDashboardContentProps {
  students: Student[];
}

interface AppliedFilters {
  grado: string;
  tipoIdentificacion: string;
  coordinadorAcademico: string;
}

const EMPTY_FILTERS: AppliedFilters = {
  grado: "",
  tipoIdentificacion: "",
  coordinadorAcademico: "",
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(values.map((value) => (value ?? "").trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

export function StudentsDashboardContent({
  students,
}: StudentsDashboardContentProps) {
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [draftFilters, setDraftFilters] =
    useState<AppliedFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<AppliedFilters>(EMPTY_FILTERS);

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

  const filteredStudents = useMemo(() => {
    const normalizedSearch = normalize(appliedSearch);
    const normalizedGrade = normalize(appliedFilters.grado);
    const normalizedIdType = normalize(appliedFilters.tipoIdentificacion);
    const normalizedCoordinator = normalize(
      appliedFilters.coordinadorAcademico,
    );

    return students.filter((student) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        normalize(student.numero_identificacion).includes(normalizedSearch) ||
        normalize(student.no_matricula).includes(normalizedSearch);

      const matchesGrade =
        normalizedGrade.length === 0 ||
        normalize(student.grado) === normalizedGrade;

      const matchesIdType =
        normalizedIdType.length === 0 ||
        normalize(student.tipo_identificacion) === normalizedIdType;

      const matchesCoordinator =
        normalizedCoordinator.length === 0 ||
        normalize(student.coordinador_academico) === normalizedCoordinator;

      return (
        matchesSearch && matchesGrade && matchesIdType && matchesCoordinator
      );
    });
  }, [students, appliedSearch, appliedFilters]);

  const hasAppliedFilters =
    appliedSearch.trim().length > 0 ||
    appliedFilters.grado.length > 0 ||
    appliedFilters.tipoIdentificacion.length > 0 ||
    appliedFilters.coordinadorAcademico.length > 0;

  function applySearch() {
    setAppliedSearch(searchInput.trim());
  }

  function clearAllFilters() {
    setSearchInput("");
    setAppliedSearch("");
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  }

  function openFilterDialog() {
    setDraftFilters(appliedFilters);
    setIsFilterDialogOpen(true);
  }

  function applyAdvancedFilters() {
    setAppliedFilters(draftFilters);
    setIsFilterDialogOpen(false);
  }

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
          Buscar estudiante por número de identificación o no. matrícula
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Ingrese número de identificación o no. matrícula"
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

      <p className="text-sm text-gray-600">
        Mostrando {filteredStudents.length} de {students.length} estudiantes
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
