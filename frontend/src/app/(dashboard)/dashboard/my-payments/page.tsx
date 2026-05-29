import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, CreditCard, Wallet } from "lucide-react";

import { getCurrentStudentPaymentsOverview } from "@/app/actions/self-service";
import { resolveCurrentUserAccess } from "@/lib/auth/resolved-access";

function toCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function MyPaymentsPage() {
  const access = await resolveCurrentUserAccess();

  if (access.role !== "estudiante") {
    redirect("/dashboard");
  }

  const overview = await getCurrentStudentPaymentsOverview();

  if (!overview.success || !overview.data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Pagos</h1>
          <p className="mt-1 text-gray-500">
            No fue posible cargar su estado de pagos: {overview.error}
          </p>
        </div>
      </div>
    );
  }

  const { student, attendance, deudaValorTotal } = overview.data;
  const clasesAdeudadas = Number(student.clases_adeudadas ?? 0);
  const clasesAdelantadas = Number(student.clases_adelantadas ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis Pagos</h1>
        <p className="mt-1 text-gray-500">
          Resumen de deuda, clases y valores asociados a su matrícula.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-600">Clases adeudadas</p>
          <p className="mt-2 flex items-center gap-2 text-3xl font-bold text-gray-900">
            <AlertTriangle className="h-6 w-6 text-rose-600" />
            {clasesAdeudadas}
          </p>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-600">Valor total deuda</p>
          <p className="mt-2 flex items-center gap-2 text-3xl font-bold text-gray-900">
            <Wallet className="h-6 w-6 text-amber-600" />
            {toCurrency(deudaValorTotal)}
          </p>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-600">Clases pagadas por adelantado</p>
          <p className="mt-2 flex items-center gap-2 text-3xl font-bold text-gray-900">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            {clasesAdelantadas}
          </p>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-600">Inasistencias registradas</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {attendance.absentCount}
          </p>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-600">Valor matrícula</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {toCurrency(Number(student.valor_matricula ?? 0))}
          </p>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-600">Valor apoyo semanal</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {toCurrency(Number(student.valor_apoyo_semanal ?? 0))}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold inline-flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Importante
        </p>
        <p className="mt-2">
          Para ponerse al día en sus pagos, contacte a su Coordinador Académico:{" "}
          <span className="font-semibold">{student.coordinador_academico}</span>
          . Debe realizar este proceso para evitar continuar en estado de deuda
          con la escuela.
        </p>
      </section>
    </div>
  );
}
