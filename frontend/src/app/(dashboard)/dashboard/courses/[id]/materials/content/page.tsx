import { MaterialsContentClient } from "@/components/course-materials/materials-content-client";
import { MaterialsNav } from "@/components/course-materials/materials-nav";
import { getCourseMaterialsDataset } from "@/lib/course-materials/mock-data";
import { getCourseMaterialsPageContext } from "@/lib/course-materials/page-context";

interface CourseMaterialsContentPageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseMaterialsContentPage({
  params,
}: CourseMaterialsContentPageProps) {
  const { id } = await params;
  const { course, canManage } = await getCourseMaterialsPageContext(id);
  const dataset = getCourseMaterialsDataset(course.nombre_curso);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contenido</h1>
        <p className="mt-1 text-sm text-gray-500">
          Carpetas y archivos de {course.nombre_curso}
        </p>
      </div>

      <MaterialsNav courseId={course.id_curso} active="content" />

      <MaterialsContentClient
        canManage={canManage}
        initialFolders={dataset.folders}
      />
    </div>
  );
}
