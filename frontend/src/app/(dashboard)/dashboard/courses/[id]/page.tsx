import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Course } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CourseDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseDetailPage({
  params,
}: CourseDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: course, error } = await supabase
    .from("cursos")
    .select("*")
    .eq("id_curso", Number(id))
    .single();

  if (error || !course) {
    notFound();
  }

  const c = course as Course;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";

    return new Date(dateStr).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
          <Link href="/dashboard/courses">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{c.nombre_curso}</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Detalle del curso</p>
        </div>
        <Button asChild>
          <Link href={`/dashboard/courses/${c.id_curso}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </Button>
      </div>

      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Información del Curso</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID del curso
              </dt>
              <dd className="mt-1 text-sm font-mono text-gray-900">
                {c.id_curso}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombre
              </dt>
              <dd className="mt-1 text-sm text-gray-900 font-medium">
                {c.nombre_curso}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nivel
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{c.nivel_curso}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Hora de inicio
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{c.hora_inicio}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Hora de fin
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{c.hora_fin}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Salón
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderValue(c.salon)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha de inicio
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{c.fecha_inicio}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha de fin
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{c.fecha_fin}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Creado
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatDate(c.created_at)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Última actualización
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatDate(c.updated_at)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
