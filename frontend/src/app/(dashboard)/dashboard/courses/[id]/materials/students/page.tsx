import { MaterialsNav } from "@/components/course-materials/materials-nav";
import { getCourseMaterialsMembers } from "@/app/actions/course-materials";
import { getCourseMaterialsPageContext } from "@/lib/course-materials/page-context";

interface CourseMaterialsStudentsPageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseMaterialsStudentsPage({
  params,
}: CourseMaterialsStudentsPageProps) {
  const { id } = await params;
  const { course } = await getCourseMaterialsPageContext(id);
  const membersResult = await getCourseMaterialsMembers(course.id_curso);
  const members = membersResult.success ? (membersResult.data ?? []) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Listado de Alumnos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Personas vinculadas actualmente a {course.nombre_curso}
        </p>
      </div>

      <MaterialsNav courseId={course.id_curso} active="students" />

      {!membersResult.success ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">
            No fue posible cargar el listado: {membersResult.error}
          </p>
        </div>
      ) : null}

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
            {members.map((member) => (
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
            {members.length === 0 ? (
              <tr className="border-t border-gray-100">
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                  No hay alumnos o profesor asociados a este curso.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
