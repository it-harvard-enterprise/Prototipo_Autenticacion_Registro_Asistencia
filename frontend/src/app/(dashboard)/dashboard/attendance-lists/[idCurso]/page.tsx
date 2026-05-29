"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  FolderOpen,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteAttendanceForCourseAndDate,
  getAttendanceDatesByCourse,
  getCourseOptions,
  type AttendanceDateOption,
  type CourseOption,
} from "@/app/actions/attendance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function AttendanceDatesByCoursePage() {
  const params = useParams<{ idCurso: string }>();
  const idCurso = Number(params.idCurso ?? 0);

  const [dates, setDates] = useState<AttendanceDateOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [targetDateToDelete, setTargetDateToDelete] = useState<string | null>(
    null,
  );
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingDateFolder, setIsDeletingDateFolder] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!Number.isInteger(idCurso) || idCurso <= 0) {
        toast.error("Curso inválido");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const [datesResult, coursesResult] = await Promise.all([
        getAttendanceDatesByCourse(idCurso),
        getCourseOptions(),
      ]);
      setIsLoading(false);

      if (!datesResult.success) {
        toast.error(
          datesResult.error ?? "No fue posible cargar las fechas de asistencia",
        );
      } else {
        setDates(datesResult.data ?? []);
      }

      if (!coursesResult.success) {
        toast.error(coursesResult.error ?? "No fue posible cargar cursos");
      } else {
        setCourses(coursesResult.data ?? []);
      }
    }

    loadData();
  }, [idCurso]);

  const courseName = useMemo(() => {
    return courses.find((course) => course.id_curso === idCurso)?.nombre_curso;
  }, [courses, idCurso]);

  async function handleDeleteDateFolder() {
    const dateToDelete = targetDateToDelete?.trim() ?? "";
    if (!dateToDelete) {
      toast.error("Seleccione una carpeta de fecha para eliminar");
      return;
    }

    if (deleteConfirmText.trim() !== "ELIMINAR") {
      toast.error("Debe escribir ELIMINAR para confirmar");
      return;
    }

    setIsDeletingDateFolder(true);
    const result = await deleteAttendanceForCourseAndDate({
      idCurso,
      date: dateToDelete,
    });
    setIsDeletingDateFolder(false);

    if (!result.success) {
      toast.error(result.error ?? "No fue posible eliminar la carpeta");
      return;
    }

    setDates((prev) => prev.filter((item) => item.date !== dateToDelete));
    setTargetDateToDelete(null);
    setDeleteConfirmText("");

    toast.success(
      `Carpeta eliminada (${result.deletedCount ?? 0} registros eliminados)`,
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/attendance-lists">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Fechas de Asistencia
          </h1>
          <p className="mt-1 text-gray-500">
            Curso #{idCurso}
            {courseName ? ` - ${courseName}` : ""}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#b92f2d]" />
            Carpetas de Fechas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando fechas...
            </div>
          ) : null}

          {!isLoading && dates.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              Este curso no tiene asistencias registradas todavía.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dates.map((item) => (
              <div
                key={item.date}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-[#b92f2d]/50 hover:shadow"
              >
                <Link
                  href={`/dashboard/attendance-lists/${idCurso}/${item.date}`}
                  className="group block"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <span className="inline-flex rounded-full bg-[#b92f2d]/10 px-2 py-1 text-xs font-semibold text-[#982725]">
                      {item.date}
                    </span>
                    <FolderOpen className="h-5 w-5 text-[#b92f2d] transition group-hover:scale-110" />
                  </div>
                  <h2 className="font-semibold text-gray-900">
                    {formatDate(item.date)}
                  </h2>
                  <p className="mt-2 text-xs text-gray-500">
                    Abrir lista de asistencia de esta fecha
                  </p>
                </Link>

                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#b92f2d]/40 text-[#b92f2d] hover:bg-[#b92f2d]/10"
                    onClick={() => {
                      setTargetDateToDelete(item.date);
                      setDeleteConfirmText("");
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar carpeta
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <AlertDialog
            open={targetDateToDelete !== null}
            onOpenChange={(open) => {
              if (!open) {
                setTargetDateToDelete(null);
                setDeleteConfirmText("");
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-bold text-[#b92f2d]">
                  Eliminar carpeta de asistencia
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción eliminará todos los registros de asistencia para
                  la fecha {targetDateToDelete ?? "seleccionada"}. Esta
                  operación no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                placeholder="Escriba ELIMINAR"
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
              />
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeletingDateFolder}>
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteDateFolder}
                  disabled={
                    isDeletingDateFolder ||
                    deleteConfirmText.trim() !== "ELIMINAR"
                  }
                  className="bg-[#b92f2d] text-white hover:bg-[#982725]"
                >
                  {isDeletingDateFolder ? "Eliminando..." : "Eliminar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
