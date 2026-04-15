import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Fingerprint } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { IDENTIFICATION_TYPE_OPTIONS } from "@/lib/identification-types";
import { Student } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface StudentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentDetailPage({
  params,
}: StudentDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: student, error } = await supabase
    .from("estudiantes")
    .select("*")
    .eq("numero_identificacion", id)
    .single();

  if (error || !student) {
    notFound();
  }

  const s = student as Student;

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
        <Button asChild>
          <Link href={`/dashboard/students/${s.numero_identificacion}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </Button>
      </div>

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
                {s.medio_pago_matricula
                  ? s.medio_pago_matricula.charAt(0).toUpperCase() +
                    s.medio_pago_matricula.slice(1)
                  : "N/A"}
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
          <CardTitle className="text-lg">Huellas Dactilares</CardTitle>
          <CardDescription>
            Estado del registro biométrico del estudiante
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-gray-50 px-4 py-3 flex items-center gap-3">
            <Fingerprint className="h-5 w-5 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">
              Funcionalidad no disponible temporalmente
            </p>
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
