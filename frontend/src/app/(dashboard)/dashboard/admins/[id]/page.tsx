import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { getAdminById } from "@/app/actions/admins";
import { IDENTIFICATION_TYPE_OPTIONS } from "@/lib/identification-types";
import { Admin } from "@/app/actions/admins";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AdminDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminDetailPage({
  params,
}: AdminDetailPageProps) {
  const { id } = await params;
  const result = await getAdminById(id);

  if (!result.success || !result.data) {
    notFound();
  }

  const admin = result.data as Admin;

  const identificationTypeLabel =
    IDENTIFICATION_TYPE_OPTIONS.find(
      (option) => option.value === admin.tipo_identificacion,
    )?.label ??
    admin.tipo_identificacion ??
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
          <Link href="/dashboard/admins">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {admin.nombres} {admin.apellidos}
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Identificación: {admin.numero_identificacion}
          </p>
        </div>
        <Button asChild>
          <Link href={`/dashboard/admins/${admin.id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </Button>
      </div>

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">
            Información del Administrador
          </CardTitle>
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
                Número de identificación
              </dt>
              <dd className="mt-1 text-sm font-mono text-gray-900">
                {admin.numero_identificacion}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombres
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderValue(admin.nombres)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Apellidos
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderValue(admin.apellidos)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Correo Electrónico
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderValue(admin.email)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rol
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                <span className="inline-flex rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  {admin.role}
                </span>
              </dd>
            </div>
            {admin.created_at && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Creado en
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(admin.created_at).toLocaleDateString("es-ES", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
