"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import {
  getAttendanceExportByCourseAndDate,
  getCourseOptions,
  type AttendanceExportRow,
  type CourseOption,
} from "@/app/actions/attendance";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalDate(dateIso: string) {
  return new Date(dateIso).toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ExportPage() {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [rows, setRows] = useState<AttendanceExportRow[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedDate, setSelectedDate] = useState(getTodayIsoDate());
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isFetchingRows, setIsFetchingRows] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    async function loadCourses() {
      setIsLoadingCourses(true);
      const result = await getCourseOptions();
      setIsLoadingCourses(false);

      if (!result.success) {
        toast.error(result.error ?? "No se pudieron cargar los cursos");
        return;
      }

      setCourses(result.data ?? []);
    }

    loadCourses();
  }, []);

  const selectedCourseName = useMemo(() => {
    const id = Number(selectedCourseId);
    if (!Number.isInteger(id)) return "";
    return courses.find((course) => course.id_curso === id)?.nombre_curso ?? "";
  }, [courses, selectedCourseId]);

  async function handleLoadAttendanceRecords() {
    const idCurso = Number(selectedCourseId);

    if (!Number.isInteger(idCurso) || idCurso <= 0) {
      toast.error("Seleccione un curso válido");
      return;
    }

    if (!selectedDate) {
      toast.error("Seleccione una fecha válida");
      return;
    }

    setIsFetchingRows(true);
    const result = await getAttendanceExportByCourseAndDate(
      idCurso,
      selectedDate,
    );
    setIsFetchingRows(false);

    if (!result.success) {
      setRows([]);
      toast.error(result.error ?? "No fue posible cargar los registros");
      return;
    }

    setRows(result.data ?? []);
    toast.success("Registros cargados correctamente");
  }

  function handleExportToExcel() {
    if (rows.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    setIsExporting(true);

    try {
      const exportRows = rows.map((row) => ({
        "ID Registro": row.id,
        "ID Curso": row.id_curso,
        Curso: row.nombre_curso,
        "Número de Identificación": row.numero_identificacion,
        Nombres: row.nombres,
        Apellidos: row.apellidos,
        Fecha: toLocalDate(row.fecha),
        Asistió: row.asistio ? "Sí" : "No",
        Saldo: row.saldo ?? "",
        "Método de Pago": row.metodo_pago ?? "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Asistencia");

      const safeCourseName =
        selectedCourseName
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .replace(/_+/g, "_")
          .slice(0, 40) || "curso";

      XLSX.writeFile(
        workbook,
        `asistencia_${safeCourseName}_${selectedDate}.xlsx`,
      );

      toast.success("Archivo Excel exportado correctamente");
    } catch {
      toast.error("No fue posible exportar el archivo Excel");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Exportar Lista de Asistencia a Excel
        </h1>
        <p className="text-gray-500 mt-1">
          Seleccione curso y fecha, cargue los registros y descárguelos en
          formato .xlsx.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros de exportación</CardTitle>
          <CardDescription>
            Se consultan los registros de asistencia guardados en base de datos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Curso *</label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={selectedCourseId}
                onChange={(event) => setSelectedCourseId(event.target.value)}
                disabled={isLoadingCourses}
              >
                <option value="">
                  {isLoadingCourses
                    ? "Cargando cursos..."
                    : "Seleccione un curso"}
                </option>
                {courses.map((course) => (
                  <option key={course.id_curso} value={String(course.id_curso)}>
                    {course.id_curso} - {course.nombre_curso}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha *</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </div>

            <Button
              type="button"
              onClick={handleLoadAttendanceRecords}
              disabled={isFetchingRows || isLoadingCourses}
              className="bg-[#b92f2d] hover:bg-[#982725] text-white"
            >
              {isFetchingRows ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cargando...
                </>
              ) : (
                "Cargar Registros"
              )}
            </Button>
          </div>

          {selectedCourseName && (
            <div className="rounded-md border border-[#b92f2d]/20 bg-[#b92f2d]/5 p-3 text-sm text-[#982725]">
              Curso seleccionado:{" "}
              <span className="font-semibold">{selectedCourseName}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            Vista previa de registros ({rows.length})
          </CardTitle>
          <CardDescription>
            Revise la información antes de exportar a Excel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>ID</TableHead>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Asistió</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Método Pago</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-gray-500"
                    >
                      Seleccione curso y fecha para cargar registros.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">
                        {row.id}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-gray-900">
                          {row.apellidos}, {row.nombres}
                        </p>
                        <p className="text-xs text-gray-500">
                          ID: {row.numero_identificacion}
                        </p>
                      </TableCell>
                      <TableCell>{row.asistio ? "Sí" : "No"}</TableCell>
                      <TableCell>{row.saldo ?? "-"}</TableCell>
                      <TableCell>{row.metodo_pago ?? "-"}</TableCell>
                      <TableCell>{toLocalDate(row.fecha)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleExportToExcel}
              disabled={rows.length === 0 || isExporting}
              className="bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exportando...
                </>
              ) : (
                "Exportar Lista de Asistencia a Excel"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
