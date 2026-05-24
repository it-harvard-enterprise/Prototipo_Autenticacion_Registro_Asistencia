"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  FileSpreadsheet,
  Filter,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteAttendanceForCourseAndDate,
  getAttendanceExportByCourseAndDate,
  type AttendanceExportRow,
} from "@/app/actions/attendance";
import { exportAttendanceRowsToExcel } from "@/lib/attendance-export-excel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AttendanceFilter = "all" | "present" | "absent";
type BalanceFilter = "all" | "debe" | "cancelado";

const EMPTY_FILTERS = {
  attendance: "all" as AttendanceFilter,
  balance: "all" as BalanceFilter,
};

function toDisplayDate(dateIso: string) {
  return new Date(dateIso).toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AttendanceListDetailsPage() {
  const router = useRouter();
  const params = useParams<{ idCurso: string; date: string }>();
  const idCurso = Number(params.idCurso ?? 0);
  const date = String(params.date ?? "");

  const [rows, setRows] = useState<AttendanceExportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingList, setIsDeletingList] = useState(false);

  useEffect(() => {
    async function loadRows() {
      if (!Number.isInteger(idCurso) || idCurso <= 0 || !date) {
        toast.error("Parámetros inválidos");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const result = await getAttendanceExportByCourseAndDate(idCurso, date);
      setIsLoading(false);

      if (!result.success) {
        toast.error(result.error ?? "No fue posible cargar la lista");
        return;
      }

      setRows(result.data ?? []);
    }

    loadRows();
  }, [idCurso, date]);

  const courseName = useMemo(() => {
    return rows[0]?.nombre_curso ?? "Curso";
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (appliedFilters.attendance === "present" && !row.asistio) return false;
      if (appliedFilters.attendance === "absent" && row.asistio) return false;
      if (appliedFilters.balance === "debe" && row.saldo !== "debe")
        return false;
      if (appliedFilters.balance === "cancelado" && row.saldo !== "cancelado") {
        return false;
      }
      return true;
    });
  }, [rows, appliedFilters]);

  const hasAppliedFilters =
    appliedFilters.attendance !== "all" || appliedFilters.balance !== "all";

  function openFilterDialog() {
    setDraftFilters(appliedFilters);
    setIsFilterDialogOpen(true);
  }

  function applyFilters() {
    setAppliedFilters(draftFilters);
    setIsFilterDialogOpen(false);
  }

  function clearAllFilters() {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  }

  async function handleExport() {
    if (filteredRows.length === 0) {
      toast.error("No hay datos para exportar con los filtros actuales");
      return;
    }

    setIsExporting(true);
    try {
      await exportAttendanceRowsToExcel({
        rows: filteredRows,
        selectedDate: date,
        selectedCourseName: courseName,
      });
      toast.success("Archivo Excel exportado correctamente");
    } catch {
      toast.error("No fue posible exportar el archivo Excel");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDeleteCurrentList() {
    if (deleteConfirmText.trim() !== "ELIMINAR") {
      toast.error("Debe escribir ELIMINAR para confirmar");
      return;
    }

    setIsDeletingList(true);
    const result = await deleteAttendanceForCourseAndDate({
      idCurso,
      date,
    });
    setIsDeletingList(false);

    if (!result.success) {
      toast.error(result.error ?? "No fue posible eliminar la lista");
      return;
    }

    toast.success(
      `Lista eliminada (${result.deletedCount ?? 0} registros eliminados)`,
    );
    setIsDeleteDialogOpen(false);
    setDeleteConfirmText("");
    router.replace(`/dashboard/attendance-lists/${idCurso}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href={`/dashboard/attendance-lists/${idCurso}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Lista de Asistencia
          </h1>
          <p className="mt-1 text-gray-500">
            Curso #{idCurso} - Fecha {date}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDeleteConfirmText("");
              setIsDeleteDialogOpen(true);
            }}
            className="border-[#b92f2d]/50 text-[#b92f2d] hover:bg-[#b92f2d]/10"
            disabled={isDeletingList || rows.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar registros
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            disabled={isExporting || filteredRows.length === 0}
            className="bg-[#b92f2d] hover:bg-[#982725] text-white"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Exportar Lista a Excel
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-white p-4">
        <p className="text-sm font-medium text-gray-800 mb-3">
          Filtrar lista por asistencia y estado de saldo
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={openFilterDialog}>
            <Filter className="mr-2 h-4 w-4" />
            Filtrar
          </Button>
          {hasAppliedFilters ? (
            <Button type="button" variant="ghost" onClick={clearAllFilters}>
              Limpiar
            </Button>
          ) : null}
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Mostrando {filteredRows.length} de {rows.length} registros
      </p>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detalle de asistencia</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando registros...
            </div>
          ) : null}

          {!isLoading && filteredRows.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              No hay registros para los filtros seleccionados.
            </div>
          ) : null}

          {!isLoading && filteredRows.length > 0 ? (
            <div className="rounded-lg border border-gray-200 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Identificación</TableHead>
                    <TableHead>Nombres</TableHead>
                    <TableHead>Apellidos</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Asistió</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Método Pago</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">
                        {row.id}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.numero_identificacion}
                      </TableCell>
                      <TableCell>{row.nombres}</TableCell>
                      <TableCell>{row.apellidos}</TableCell>
                      <TableCell>{toDisplayDate(row.fecha)}</TableCell>
                      <TableCell>{row.asistio ? "Sí" : "No"}</TableCell>
                      <TableCell>{row.saldo ?? "NULL"}</TableCell>
                      <TableCell>{row.metodo_pago ?? "NULL"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold text-[#b92f2d]">
              Eliminar lista de asistencia
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará todos los registros de asistencia del curso
              #{idCurso} para la fecha {date}. Esta operación no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Escriba ELIMINAR"
            value={deleteConfirmText}
            onChange={(event) => setDeleteConfirmText(event.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingList}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCurrentList}
              disabled={
                isDeletingList || deleteConfirmText.trim() !== "ELIMINAR"
              }
              className="bg-[#b92f2d] text-white hover:bg-[#982725]"
            >
              {isDeletingList ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filtrar lista de asistencia</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="filter-attendance">Asistencia</Label>
              <select
                id="filter-attendance"
                value={draftFilters.attendance}
                onChange={(event) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    attendance: event.target.value as AttendanceFilter,
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">Todos</option>
                <option value="present">Asistió</option>
                <option value="absent">No asistió</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-balance">Saldo</Label>
              <select
                id="filter-balance"
                value={draftFilters.balance}
                onChange={(event) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    balance: event.target.value as BalanceFilter,
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">Todos</option>
                <option value="debe">Debe</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDraftFilters(EMPTY_FILTERS)}
            >
              Limpiar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFilterDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={applyFilters}>
              Aplicar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
