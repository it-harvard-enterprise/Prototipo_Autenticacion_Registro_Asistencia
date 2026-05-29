"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getCourseOptions, type CourseOption } from "@/app/actions/attendance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function AttendanceListsPage() {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadCourses() {
      setIsLoading(true);
      const result = await getCourseOptions();
      setIsLoading(false);

      if (!result.success) {
        toast.error(result.error ?? "No se pudieron cargar los cursos");
        return;
      }

      setCourses(result.data ?? []);
    }

    loadCourses();
  }, []);

  const filteredCourses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return courses;

    return courses.filter((course) => {
      const idMatches = String(course.id_curso).includes(normalized);
      const nameMatches = course.nombre_curso
        .toLowerCase()
        .includes(normalized);
      return idMatches || nameMatches;
    });
  }, [courses, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Listas de Asistencia
        </h1>
        <p className="mt-1 text-gray-500">
          Seleccione un curso para abrir sus carpetas de fechas de asistencia.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#b92f2d]" />
            Carpetas de Cursos
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
              Cargando cursos...
            </div>
          ) : null}

          {!isLoading && filteredCourses.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              No hay cursos disponibles para mostrar.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map((course) => (
              <Link
                key={course.id_curso}
                href={`/dashboard/attendance-lists/${course.id_curso}`}
                className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-[#b92f2d]/50 hover:shadow"
              >
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
                  Abrir fechas de asistencia registradas
                </p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
