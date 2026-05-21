import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Fingerprint } from "lucide-react";
import { getStudentById } from "@/app/actions/students";
import { IDENTIFICATION_TYPE_OPTIONS } from "@/lib/identification-types";
import { Student } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EnrollmentConfirmationPdfButton } from "@/components/enrollment-confirmation-pdf-button";
import { UserProfileActions } from "@/components/user-profile-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface StudentDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ autogenerate_pdf?: string; auto_pdf?: string }>;
}

export default async function StudentDetailPage({
  params,
  searchParams,
}: StudentDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const shouldAutoGeneratePdf =
    resolvedSearchParams?.autogenerate_pdf === "1" ||
    resolvedSearchParams?.auto_pdf === "1";
  const result = await getStudentById(id);
  if (!result.success || !result.data) {
    notFound();
  }

  const s = result.data as Student;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "N/A";

    return new Date(dateStr).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (value?: number | null) => {
    if (value === null || value === undefined) return "N/A";
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const identificationTypeLabel =
    IDENTIFICATION_TYPE_OPTIONS.find(
      (option) => option.value === s.tipo_identificacion,
    )?.label ??
    s.tipo_identificacion ??
    "N/A";

  const renderValue = (value?: string | null) => {
    if (!value || value.trim() === "") {
      return <span className="text-gray-400 italic">N/A</span>;
    }

    return value;
  };

  const hasFingerprintRight = Boolean(
    s.huella_indice_derecho && s.huella_indice_derecho.trim() !== "",
  );
  const hasFingerprintLeft = Boolean(
    s.huella_indice_izquierdo && s.huella_indice_izquierdo.trim() !== "",
  );
  const hasFingerprints = hasFingerprintRight && hasFingerprintLeft;

  const clasesAdeudadas = Number(s.clases_adeudadas ?? 0);
  const clasesAdelantadas = Number(s.clases_adelantadas ?? 0);
  const deudaActual = Number(
    s.deuda_actual ?? clasesAdeudadas * Number(s.valor_apoyo_semanal ?? 0),
  );
  const estadoPagoTexto =
    clasesAdeudadas > 0
      ? `Debe - ${formatCurrency(deudaActual)}`
      : clasesAdelantadas > 0
        ? `Adelantado (${clasesAdelantadas} clases)`
        : "Al día";
  const estadoPagoClassName =
    clasesAdeudadas > 0
      ? "text-red-600 bg-red-50 border-red-200"
      : "text-emerald-700 bg-emerald-50 border-emerald-200";

  const paymentMethodLabel = s.medio_pago_matricula
    ? s.medio_pago_matricula.charAt(0).toUpperCase() +
      s.medio_pago_matricula.slice(1)
    : "N/A";

  const pdfFields = [
    { label: "Tipo de identificación", value: identificationTypeLabel },
    { label: "Identificación", value: s.numero_identificacion },
    { label: "No. matrícula", value: s.no_matricula ?? "N/A" },
    { label: "Nombres", value: s.nombres },
    { label: "Apellidos", value: s.apellidos },
    { label: "Correo electrónico", value: s.email ?? "N/A" },
    { label: "Grado", value: s.grado },
    { label: "Teléfono", value: s.telefono ?? "N/A" },
    { label: "Dirección", value: s.direccion ?? "N/A" },
    { label: "Barrio", value: s.barrio ?? "N/A" },
    { label: "Programa", value: s.programa ?? "N/A" },
    { label: "Coordinador académico", value: s.coordinador_academico ?? "N/A" },
    { label: "Nombre del acudiente", value: s.nombre_acudiente ?? "N/A" },
    { label: "Teléfono del acudiente", value: s.telefono_acudiente ?? "N/A" },
    { label: "Entidad Prestadora de Salud (EPS)", value: s.eps ?? "N/A" },
    { label: "Fecha de inicio", value: formatDate(s.fecha_inicio) },
    { label: "Fecha de matrícula", value: formatDate(s.fecha_matricula) },
    { label: "Valor matrícula", value: formatCurrency(s.valor_matricula) },
    { label: "Medio de pago matrícula", value: paymentMethodLabel },
    {
      label: "Valor apoyo semanal",
      value: formatCurrency(s.valor_apoyo_semanal),
    },
    { label: "Estado de pago", value: estadoPagoTexto },
    { label: "Clases adeudadas", value: String(clasesAdeudadas) },
    { label: "Clases adelantadas", value: String(clasesAdelantadas) },
    {
      label: "Total pagado",
      value: formatCurrency(Number(s.total_pagado ?? 0)),
    },
    {
      label: "Huellas dactilares",
      value: `Derecha: ${hasFingerprintRight ? "Registrada" : "Pendiente"} | Izquierda: ${hasFingerprintLeft ? "Registrada" : "Pendiente"}`,
    },
    { label: "Creado", value: formatDate(s.created_at) },
    { label: "Última actualización", value: formatDate(s.updated_at) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/students">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {s.nombres} {s.apellidos}
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Identificación: {s.numero_identificacion}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EnrollmentConfirmationPdfButton
            subjectType="estudiante"
            fullName={`${s.nombres} ${s.apellidos}`}
            identification={s.numero_identificacion}
            fields={pdfFields}
            autoGenerateOnMount={shouldAutoGeneratePdf}
          />
          <Button asChild>
            <Link href={`/dashboard/students/${s.numero_identificacion}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      <UserProfileActions
        entityType="estudiante"
        numeroIdentificacion={s.numero_identificacion}
        email={s.email}
        profileStatus={s.perfil_usuario}
      />

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Información del Estudiante</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tipo de identificación
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {identificationTypeLabel}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Identificación
              </dt>
              <dd className="mt-1 text-sm font-mono text-gray-900">
                {s.numero_identificacion}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                No. matrícula
              </dt>
              <dd className="mt-1 text-sm font-mono text-gray-900">
                {renderValue(s.no_matricula)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombres
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{s.nombres}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Apellidos
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{s.apellidos}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Correo electrónico
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderValue(s.email)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Grado
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{s.grado}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Teléfono
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderValue(s.telefono)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Dirección
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderValue(s.direccion)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Barrio
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderValue(s.barrio)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Programa
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderValue(s.programa)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Coordinador académico
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderValue(s.coordinador_academico)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombre del acudiente
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderValue(s.nombre_acudiente)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Teléfono del acudiente
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderValue(s.telefono_acudiente)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Entidad Prestadora de Salud (EPS)
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderValue(s.eps)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha de inicio
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatDate(s.fecha_inicio)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha de matrícula
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatDate(s.fecha_matricula)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Valor matrícula
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatCurrency(s.valor_matricula)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Medio de pago matrícula
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {paymentMethodLabel}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Valor apoyo semanal
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatCurrency(s.valor_apoyo_semanal)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Estado de Pagos</CardTitle>
          <CardDescription>
            Balance actual de clases adeudadas, adelantadas y pagos acumulados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoPagoClassName}`}
            >
              {estadoPagoTexto}
            </span>
          </div>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Clases adeudadas
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{clasesAdeudadas}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Clases adelantadas
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {clasesAdelantadas}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total pagado
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatCurrency(Number(s.total_pagado ?? 0))}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Huellas Dactilares</CardTitle>
          <CardDescription>
            Estado del registro biométrico del estudiante
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-gray-50 px-4 py-3 flex items-center gap-3">
            <Fingerprint className="h-5 w-5 text-gray-400" />
            <div className="text-sm text-gray-700">
              <p className="font-medium">
                {hasFingerprints
                  ? "Huellas registradas"
                  : "Huellas no registradas"}
              </p>
              <p className="text-xs text-gray-500">
                Derecha: {hasFingerprintRight ? "Registrada" : "Pendiente"} ·
                Izquierda: {hasFingerprintLeft ? "Registrada" : "Pendiente"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-50 max-w-4xl mx-auto">
        <CardContent className="pt-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            <div>
              <dt className="text-xs font-medium text-gray-500">Creado</dt>
              <dd className="text-xs text-gray-600">
                {formatDate(s.created_at)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">
                Última actualización
              </dt>
              <dd className="text-xs text-gray-600">
                {formatDate(s.updated_at)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
