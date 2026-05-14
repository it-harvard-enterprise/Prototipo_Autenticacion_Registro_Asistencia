import { callBackend } from "@/lib/backend/server-api";
import { resolveCurrentUserAccess } from "@/lib/auth/resolved-access";
import Link from "next/link";
import Image from "next/image";
import {
  Users,
  BookOpen,
  ClipboardList,
  FileSpreadsheet,
  HandCoins,
  BarChart3,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type DashboardSummary = {
  studentsCount: number;
  coursesCount: number;
  attendedCount: number;
  absentCount: number;
};

type DashboardSummaryResponse = {
  success: boolean;
  data?: DashboardSummary;
  error?: string;
};

export default async function DashboardPage() {
  const access = await resolveCurrentUserAccess();
  const metadata = (access.user?.user_metadata ?? {}) as Record<
    string,
    unknown
  >;
  const fallbackName =
    typeof metadata.first_name === "string"
      ? `${metadata.first_name} ${typeof metadata.last_name === "string" ? metadata.last_name : ""}`.trim()
      : undefined;

  const displayName =
    access.fullName?.trim() || fallbackName || access.user?.email || "";

  let summary: DashboardSummary = {
    studentsCount: 0,
    coursesCount: 0,
    attendedCount: 0,
    absentCount: 0,
  };

  try {
    const payload = await callBackend<DashboardSummaryResponse>(
      "/api/dashboard/summary",
      {
        method: "GET",
      },
    );

    if (payload.success && payload.data) {
      summary = payload.data;
    }
  } catch {
    // Keep zeros if backend summary is unavailable.
  }

  const studentsCount = summary.studentsCount;
  const coursesCount = summary.coursesCount;
  const attendedCount = summary.attendedCount;
  const absentCount = summary.absentCount;

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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Procesar Pago
            </CardTitle>
            <div className="p-2 rounded-lg bg-emerald-50">
              <HandCoins className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-3">
              Registre pagos de deuda o pagos adelantados por estudiante.
            </CardDescription>
            <Button
              asChild
              className="bg-[#b92f2d] hover:bg-[#982725] text-white"
            >
              <Link href="/dashboard/payments/process">Ir a Procesar Pago</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Reporte de Pagos
            </CardTitle>
            <div className="p-2 rounded-lg bg-sky-50">
              <BarChart3 className="h-4 w-4 text-sky-700" />
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-3">
              Consulte comparativos y totales de recaudo por periodo.
            </CardDescription>
            <Button
              asChild
              className="bg-[#b92f2d] hover:bg-[#982725] text-white"
            >
              <Link href="/dashboard/payments/report">Ir al Reporte</Link>
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
