import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { getProfessorById } from "@/app/actions/professors";
import { IDENTIFICATION_TYPE_OPTIONS } from "@/lib/identification-types";
import { Professor } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EnrollmentConfirmationPdfButton } from "@/components/enrollment-confirmation-pdf-button";
import { UserProfileActions } from "@/components/user-profile-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProfessorDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ autogenerate_pdf?: string; auto_pdf?: string }>;
}

export default async function ProfessorDetailPage({
  params,
  searchParams,
}: ProfessorDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const shouldAutoGeneratePdf =
    resolvedSearchParams?.autogenerate_pdf === "1" ||
    resolvedSearchParams?.auto_pdf === "1";
  const result = await getProfessorById(id);
  if (!result.success || !result.data) {
    notFound();
  }

  const p = result.data as Professor;

  const identificationTypeLabel =
    IDENTIFICATION_TYPE_OPTIONS.find(
      (option) => option.value === p.tipo_identificacion,
    )?.label ??
    p.tipo_identificacion ??
    "N/A";

  const renderValue = (value?: string | null) => {
    if (!value || value.trim() === "") {
      return <span className="text-gray-400 italic">N/A</span>;
    }

    return value;
  };

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

  const pdfFields = [
    { label: "Tipo de identificación", value: identificationTypeLabel },
    { label: "Identificación", value: p.numero_identificacion },
    { label: "Nombres", value: p.nombres },
    { label: "Apellidos", value: p.apellidos },
    { label: "Correo electrónico", value: p.email ?? "N/A" },
    { label: "Teléfono", value: p.telefono ?? "N/A" },
    { label: "Dirección", value: p.direccion ?? "N/A" },
    { label: "Barrio", value: p.barrio ?? "N/A" },
    {
      label: "Contacto de emergencia",
      value: p.nombre_contacto_emergencia ?? "N/A",
    },
    {
      label: "Teléfono emergencia",
      value: p.telefono_contacto_emergencia ?? "N/A",
    },
    { label: "EPS", value: p.eps ?? "N/A" },
    { label: "Creado", value: formatDate(p.created_at) },
    { label: "Última actualización", value: formatDate(p.updated_at) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/professors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {p.nombres} {p.apellidos}
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Identificación: {p.numero_identificacion}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EnrollmentConfirmationPdfButton
            subjectType="profesor"
            fullName={`${p.nombres} ${p.apellidos}`}
            identification={p.numero_identificacion}
            fields={pdfFields}
            autoGenerateOnMount={shouldAutoGeneratePdf}
          />
          <Button asChild>
            <Link
              href={`/dashboard/professors/${p.numero_identificacion}/edit`}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      <UserProfileActions
        entityType="profesor"
        numeroIdentificacion={p.numero_identificacion}
        email={p.email}
        profileStatus={p.perfil_usuario}
      />

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Información del Profesor</CardTitle>
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
                {p.numero_identificacion}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombres
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{p.nombres}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Apellidos
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{p.apellidos}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Correo electrónico
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{p.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Teléfono
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderValue(p.telefono)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Dirección
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderValue(p.direccion)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Barrio
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderValue(p.barrio)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contacto de emergencia
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderValue(p.nombre_contacto_emergencia)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Teléfono emergencia
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderValue(p.telefono_contacto_emergencia)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                EPS
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderValue(p.eps)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="bg-gray-50 max-w-4xl mx-auto">
        <CardContent className="pt-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            <div>
              <dt className="text-xs font-medium text-gray-500">Creado</dt>
              <dd className="text-xs text-gray-600">
                {formatDate(p.created_at)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">
                Última actualización
              </dt>
              <dd className="text-xs text-gray-600">
                {formatDate(p.updated_at)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
