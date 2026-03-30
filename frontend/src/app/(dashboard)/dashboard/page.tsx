import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import { Users, BookOpen, ClipboardList, FileSpreadsheet } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user?.id ?? "")
    .single();

  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : user?.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
      : user?.email;

  const [
    studentsCountResult,
    coursesCountResult,
    attendedCountResult,
    absentCountResult,
  ] = await Promise.all([
    supabase.from("estudiantes").select("*", { count: "exact", head: true }),
    supabase.from("cursos").select("*", { count: "exact", head: true }),
    supabase
      .from("registro_asistencia")
      .select("*", { count: "exact", head: true })
      .eq("asistio", true),
    supabase
      .from("registro_asistencia")
      .select("*", { count: "exact", head: true })
      .eq("asistio", false),
  ]);

  const studentsCount = studentsCountResult.count ?? 0;
  const coursesCount = coursesCountResult.count ?? 0;
  const attendedCount = attendedCountResult.count ?? 0;
  const absentCount = absentCountResult.count ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, Administrador {displayName}
        </h1>
        <p className="text-gray-500 mt-1">
          Resumen general del sistema. Utilizando esta herramienta podrá
          gestionar estudiantes, cursos, asociar estudiantes a uno o muchos
          cursos, y realizar registros de asistencia utilizando huellas. Además,
          podrá exportar la lista de asistencia a Excel para su análisis y
          seguimiento.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Estudiantes
            </CardTitle>
            <div className="p-2 rounded-lg bg-[#b92f2d]/10">
              <Users className="h-4 w-4 text-[#b92f2d]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {studentsCount}
            </div>
            <CardDescription className="mt-1">
              Estudiantes registrados
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Cursos
            </CardTitle>
            <div className="p-2 rounded-lg bg-emerald-50">
              <BookOpen className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {coursesCount}
            </div>
            <CardDescription className="mt-1">
              Cursos registrados
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Asistencia
            </CardTitle>
            <div className="p-2 rounded-lg bg-amber-50">
              <ClipboardList className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-sm text-gray-600">Han asistido</div>
            <div className="text-2xl font-bold text-gray-900">
              {attendedCount}
            </div>
            <div className="text-sm text-gray-600">No han asistido</div>
            <div className="text-2xl font-bold text-gray-900">
              {absentCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Exportar Lista a Excel
            </CardTitle>
            <div className="p-2 rounded-lg bg-purple-50">
              <FileSpreadsheet className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-3">
              Descargue la lista de asistencia por curso y fecha.
            </CardDescription>
            <Button
              asChild
              className="bg-[#b92f2d] hover:bg-[#982725] text-white"
            >
              <Link href="/dashboard/export">Ir a Exportar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center pt-2">
        <Image
          src="/logos/Logo_Nuevo.png"
          alt="Logo Harvard Enterprise"
          width={350}
          height={370}
          className="h-[370px] w-[350px]"
          priority
        />
      </div>
    </div>
  );
}
