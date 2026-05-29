import { MaterialsNav } from "@/components/course-materials/materials-nav";
import { MaterialsGradesBySubjectClient } from "@/components/course-materials/materials-grades-by-subject-client";
import { getCourseGradesForMaterialsView } from "@/app/actions/grades";
import { getCourseMaterialsPageContext } from "@/lib/course-materials/page-context";

interface CourseMaterialsGradesPageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseMaterialsGradesPage({
  params,
}: CourseMaterialsGradesPageProps) {
  const { id } = await params;
  const { course } = await getCourseMaterialsPageContext(id);
  const gradesResult = await getCourseGradesForMaterialsView(course.id_curso);

  const students = gradesResult.success
    ? (gradesResult.data?.students ?? [])
    : [];
  const viewerRole = gradesResult.data?.viewer_role ?? "profesor";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calificaciones</h1>
        <p className="mt-1 text-sm text-gray-500">
          {gradesResult.success && gradesResult.data
            ? `Periodo ${gradesResult.data.period.period_label} - ${course.nombre_curso}`
            : `Seguimiento de notas para ${course.nombre_curso}`}
        </p>
      </div>

      <MaterialsNav courseId={course.id_curso} active="grades" />

      {!gradesResult.success ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">
            No fue posible cargar calificaciones: {gradesResult.error}
          </p>
        </div>
      ) : (
        <MaterialsGradesBySubjectClient
          rows={students}
          isStudentViewer={viewerRole === "estudiante"}
        />
      )}
    </div>
  );
}
