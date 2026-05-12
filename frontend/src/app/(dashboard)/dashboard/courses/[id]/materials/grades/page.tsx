import { MaterialsNav } from "@/components/course-materials/materials-nav";
import { MaterialsGradesClient } from "@/components/course-materials/materials-grades-client";
import { getCourseMaterialsDataset } from "@/lib/course-materials/mock-data";
import { getCourseMaterialsPageContext } from "@/lib/course-materials/page-context";

interface CourseMaterialsGradesPageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseMaterialsGradesPage({
  params,
}: CourseMaterialsGradesPageProps) {
  const { id } = await params;
  const { course, canManage } = await getCourseMaterialsPageContext(id);
  const dataset = getCourseMaterialsDataset(course.nombre_curso);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calificaciones</h1>
        <p className="mt-1 text-sm text-gray-500">
          Seguimiento de notas para {course.nombre_curso}
        </p>
      </div>

      <MaterialsNav courseId={course.id_curso} active="grades" />

      <MaterialsGradesClient
        canManage={canManage}
        initialColumns={dataset.gradeColumns}
        rows={dataset.gradeRows}
      />
    </div>
  );
}
