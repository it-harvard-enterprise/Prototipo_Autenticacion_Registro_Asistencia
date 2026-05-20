import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MaterialsNav } from "@/components/course-materials/materials-nav";
import { MaterialsHomeClient } from "@/components/course-materials/materials-home-client";
import { getCourseMaterialsPageContext } from "@/lib/course-materials/page-context";
import { getCourseMaterialsSnapshot } from "@/app/actions/course-materials";

interface CourseMaterialsHomePageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseMaterialsHomePage({
  params,
}: CourseMaterialsHomePageProps) {
  const { id } = await params;
  const { course, canManage, access } = await getCourseMaterialsPageContext(id);
  const snapshotResult = await getCourseMaterialsSnapshot(course.id_curso);
  const backHref =
    access.role === "administrador"
      ? `/dashboard/courses/${course.id_curso}`
      : "/dashboard/my-courses";

  const snapshot = snapshotResult.success
    ? snapshotResult.data
    : {
        coverImageUrl: null,
        folders: [],
        files: [],
      };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Materiales del Curso
          </h1>
          <p className="mt-1 text-sm text-gray-500">{course.nombre_curso}</p>
        </div>
      </div>

      <MaterialsNav courseId={course.id_curso} active="home" />

      {!snapshotResult.success ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">
            No fue posible cargar los materiales: {snapshotResult.error}
          </p>
        </div>
      ) : null}

      <MaterialsHomeClient
        courseId={course.id_curso}
        courseName={course.nombre_curso}
        canManage={canManage}
        currentRole={access.role}
        initialCoverImageUrl={snapshot.coverImageUrl}
        folders={snapshot.folders}
        files={snapshot.files}
      />
    </div>
  );
}
