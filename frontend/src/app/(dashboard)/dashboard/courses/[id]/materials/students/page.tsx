import { MaterialsNav } from "@/components/course-materials/materials-nav";
import { getCourseMaterialsDataset } from "@/lib/course-materials/mock-data";
import { getCourseMaterialsPageContext } from "@/lib/course-materials/page-context";

interface CourseMaterialsStudentsPageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseMaterialsStudentsPage({
  params,
}: CourseMaterialsStudentsPageProps) {
  const { id } = await params;
  const { course } = await getCourseMaterialsPageContext(id);
  const dataset = getCourseMaterialsDataset(course.nombre_curso);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Listado de Alumnos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Personas vinculadas actualmente a {course.nombre_curso}
        </p>
      </div>

      <MaterialsNav courseId={course.id_curso} active="students" />

      <section className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-3 py-3 text-left font-semibold">
                Rol de perfil
              </th>
              <th className="px-3 py-3 text-left font-semibold">Nombres</th>
              <th className="px-3 py-3 text-left font-semibold">Apellidos</th>
              <th className="px-3 py-3 text-left font-semibold">Telefono</th>
              <th className="px-3 py-3 text-left font-semibold">Email</th>
            </tr>
          </thead>
          <tbody>
            {dataset.members.map((member) => (
              <tr key={member.id} className="border-t border-gray-100">
                <td className="px-3 py-3 capitalize text-gray-700">
                  {member.role}
                </td>
                <td className="px-3 py-3 text-gray-900">{member.nombres}</td>
                <td className="px-3 py-3 text-gray-900">{member.apellidos}</td>
                <td className="px-3 py-3 text-gray-700">{member.telefono}</td>
                <td className="px-3 py-3 text-gray-700">{member.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
