import { getCourses } from "@/app/actions/courses";
import { getStudents } from "@/app/actions/students";
import { NewStudentButton } from "@/components/new-student-button";
import { StudentsDashboardContent } from "@/components/students-dashboard-content";
import { Course, Student } from "@/lib/types";

export default async function StudentsPage() {
  const [studentsResult, coursesResult] = await Promise.all([
    getStudents(),
    getCourses(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estudiantes</h1>
          <p className="text-gray-500 mt-1">
            Gestión de estudiantes registrados en el sistema
          </p>
        </div>
        <NewStudentButton />
      </div>

      {!studentsResult.success ? (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">
            Error al cargar los estudiantes: {studentsResult.error}
          </p>
        </div>
      ) : (
        <StudentsDashboardContent
          students={(studentsResult.data ?? []) as Student[]}
          courses={(coursesResult.data ?? []) as Course[]}
        />
      )}
    </div>
  );
}
