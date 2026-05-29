import { redirect } from "next/navigation";
import { BookOpen, CheckCircle2, CircleX, UserRound } from "lucide-react";

import { getCurrentUserProfileOverview } from "@/app/actions/self-service";
import { resolveCurrentUserAccess } from "@/lib/auth/resolved-access";

function renderValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "N/A";
  }

  if (typeof value === "number") {
    return value.toLocaleString("es-CO");
  }

  const normalized = String(value).trim();
  return normalized || "N/A";
}

function toCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function MyProfilePage() {
  const access = await resolveCurrentUserAccess();

  if (access.role === "administrador") {
    redirect("/dashboard");
  }

  if (access.role !== "estudiante" && access.role !== "profesor") {
    redirect("/dashboard");
  }

  const overview = await getCurrentUserProfileOverview();

  if (!overview.success || !overview.data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
          <p className="mt-1 text-gray-500">
            No fue posible cargar su perfil: {overview.error}
          </p>
        </div>
      </div>
    );
  }

  const data = overview.data;
  const isStudent = data.role === "estudiante";
  const student = data.student;
  const professor = data.professor;

  const profileRows = isStudent
    ? [
        ["Tipo de identificación", student?.tipo_identificacion],
        ["Número de identificación", student?.numero_identificacion],
        ["No. matrícula", student?.no_matricula],
        ["Nombres", student?.nombres],
        ["Apellidos", student?.apellidos],
        ["Email", student?.email],
        ["Grado", student?.grado],
        ["Teléfono", student?.telefono],
        ["Dirección", student?.direccion],
        ["Barrio", student?.barrio],
        ["Nombre acudiente", student?.nombre_acudiente],
        ["Teléfono acudiente", student?.telefono_acudiente],
        ["EPS", student?.eps],
        ["Coordinador académico", student?.coordinador_academico],
        ["Programa", student?.programa],
        ["Fecha inicio", student?.fecha_inicio],
        ["Fecha matrícula", student?.fecha_matricula],
        ["Valor matrícula", toCurrency(Number(student?.valor_matricula ?? 0))],
        [
          "Valor apoyo semanal",
          toCurrency(Number(student?.valor_apoyo_semanal ?? 0)),
        ],
      ]
    : [
        ["Tipo de identificación", professor?.tipo_identificacion],
        ["Número de identificación", professor?.numero_identificacion],
        ["Nombres", professor?.nombres],
        ["Apellidos", professor?.apellidos],
        ["Email", professor?.email],
        ["Teléfono", professor?.telefono],
        ["Dirección", professor?.direccion],
        ["Barrio", professor?.barrio],
        ["Nombre contacto emergencia", professor?.nombre_contacto_emergencia],
        [
          "Teléfono contacto emergencia",
          professor?.telefono_contacto_emergencia,
        ],
        ["EPS", professor?.eps],
      ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
        <p className="mt-1 text-gray-500">
          Información registrada en base de datos para su cuenta.
        </p>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#b92f2d]/10 p-2">
            <UserRound className="h-5 w-5 text-[#b92f2d]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {data.fullName}
            </h2>
            <p className="text-sm text-gray-600 capitalize">Rol: {data.role}</p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
          {profileRows.map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {label}
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderValue(value)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {isStudent ? (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-600">Asistencias registradas</p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              {data.attendance.attendedCount}
            </p>
          </article>
          <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-600">Inasistencias registradas</p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
              <CircleX className="h-5 w-5 text-rose-600" />
              {data.attendance.absentCount}
            </p>
          </article>
          <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-600">Total registros</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {data.attendance.totalCount}
            </p>
          </article>
        </section>
      ) : null}

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          Cursos Inscritos
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Cursos activos asociados a su perfil.
        </p>

        <div className="mt-4 space-y-2">
          {data.courses.map((course) => (
            <div
              key={course.id_curso}
              className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm"
            >
              <p className="font-semibold text-gray-900">
                {course.nombre_curso}
              </p>
              <p className="mt-1 text-gray-600">
                {course.hora_inicio} - {course.hora_fin} · Salón:{" "}
                {renderValue(course.salon)}
              </p>
            </div>
          ))}

          {data.courses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              <p className="inline-flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                No hay cursos asociados actualmente.
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
