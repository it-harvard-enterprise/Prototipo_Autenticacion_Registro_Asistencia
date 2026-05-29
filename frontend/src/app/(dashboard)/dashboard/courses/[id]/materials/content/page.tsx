import { MaterialsContentClient } from "@/components/course-materials/materials-content-client";
import { MaterialsNav } from "@/components/course-materials/materials-nav";
import { getCourseMaterialsPageContext } from "@/lib/course-materials/page-context";
import { getCourseMaterialsSnapshot } from "@/app/actions/course-materials";

interface CourseMaterialsContentPageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseMaterialsContentPage({
  params,
}: CourseMaterialsContentPageProps) {
  const { id } = await params;
  const { course, canManage } = await getCourseMaterialsPageContext(id);
  const snapshotResult = await getCourseMaterialsSnapshot(course.id_curso);

  const snapshot = snapshotResult.success
    ? snapshotResult.data
    : {
        coverImageUrl: null,
        folders: [],
        files: [],
      };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contenido</h1>
        <p className="mt-1 text-sm text-gray-500">
          Carpetas y archivos de {course.nombre_curso}
        </p>
      </div>

      <MaterialsNav courseId={course.id_curso} active="content" />

      {!snapshotResult.success ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">
            No fue posible cargar los materiales: {snapshotResult.error}
          </p>
        </div>
      ) : null}

      <MaterialsContentClient
        courseId={course.id_curso}
        canManage={canManage}
        initialFolders={snapshot.folders}
      />
    </div>
  );
}
