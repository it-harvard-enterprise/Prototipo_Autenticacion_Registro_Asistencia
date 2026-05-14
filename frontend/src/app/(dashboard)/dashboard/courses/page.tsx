import Link from "next/link";
import { Plus } from "lucide-react";
import { getCourses } from "@/app/actions/courses";
import { Button } from "@/components/ui/button";
import { DetailLookup } from "@/components/detail-lookup";
import { CoursesTable } from "@/components/courses-table";
import { Course } from "@/lib/types";

export default async function CoursesPage() {
  const result = await getCourses();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cursos</h1>
          <p className="text-gray-500 mt-1">
            Gestión de cursos registrados en el sistema
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/courses/new">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Curso
          </Link>
        </Button>
      </div>

      <DetailLookup type="course" />

      {!result.success ? (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">
            Error al cargar los cursos: {result.error}
          </p>
        </div>
      ) : (
        <CoursesTable courses={(result.data ?? []) as Course[]} />
      )}
    </div>
  );
}
