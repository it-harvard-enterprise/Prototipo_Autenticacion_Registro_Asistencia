import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { BookOpen, Clock3, DoorOpen, Layers } from "lucide-react";

import { getCurrentUserCoursesOverview } from "@/app/actions/self-service";
import { resolveCurrentUserAccess } from "@/lib/auth/resolved-access";

function formatHour(hour: string): string {
  if (!hour) return "N/A";
  return hour.length >= 5 ? hour.slice(0, 5) : hour;
}

export default async function MyCoursesPage() {
  const access = await resolveCurrentUserAccess();

  if (access.role === "administrador") {
    redirect("/dashboard/courses");
  }

  if (access.role !== "estudiante" && access.role !== "profesor") {
    redirect("/dashboard");
  }

  const overview = await getCurrentUserCoursesOverview();

  if (!overview.success || !overview.data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Cursos</h1>
          <p className="mt-1 text-gray-500">
            No fue posible cargar los cursos asociados: {overview.error}
          </p>
        </div>
      </div>
    );
  }

  const courses = overview.data.courses;
  const isProfessor = overview.data.role === "profesor";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis Cursos</h1>
        <p className="mt-1 text-gray-500">
          Tarjetas de los cursos donde se encuentra inscrito actualmente.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((course) => (
          <article
            key={course.id_curso}
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
          >
            <Link
              href={`/dashboard/courses/${course.id_curso}/materials`}
              className="block"
            >
              <div className="relative h-40 bg-gradient-to-r from-[#3d100f] via-[#6b1e1d] to-[#b92f2d]">
                <Image
                  src={`/api/course-materials/cover?id_curso=${course.id_curso}`}
                  alt={`Portada ${course.nombre_curso}`}
                  fill
                  unoptimized
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/25" />
                <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-[#6b1e1d]">
                  #{course.id_curso}
                </div>
              </div>
            </Link>

            <div className="space-y-3 p-4">
              <div>
                <h2 className="line-clamp-2 text-base font-semibold text-gray-900">
                  {course.nombre_curso}
                </h2>
                <p className="mt-1 flex items-center gap-1 text-xs text-gray-600">
                  <Layers className="h-3.5 w-3.5" />
                  Nivel: {course.nivel_curso}
                </p>
              </div>

              <div className="space-y-1 text-sm text-gray-700">
                <p className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-[#b92f2d]" />
                  {formatHour(course.hora_inicio)} -{" "}
                  {formatHour(course.hora_fin)}
                </p>
                <p className="flex items-center gap-2">
                  <DoorOpen className="h-4 w-4 text-[#b92f2d]" />
                  {course.salon?.trim() || "Sin salón asignado"}
                </p>
                <p className="text-xs text-gray-500">Curso activo</p>
              </div>

              <Link
                href={`/dashboard/courses/${course.id_curso}/materials`}
                className="inline-flex items-center gap-2 rounded-lg bg-[#b92f2d] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#982725]"
              >
                <BookOpen className="h-4 w-4" />
                {isProfessor ? "Gestionar materiales" : "Ver materiales"}
              </Link>
            </div>
          </article>
        ))}

        {courses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm text-gray-600 sm:col-span-2 xl:col-span-3">
            Actualmente no tiene cursos asociados.
          </div>
        ) : null}
      </div>
    </div>
  );
}
