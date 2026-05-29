"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Student } from "@/lib/types";
import { deleteStudent } from "@/app/actions/students";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface StudentsTableProps {
  students: Student[];
}

const PAGE_SIZE = 10;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function StudentsTable({ students }: StudentsTableProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(students.length / PAGE_SIZE));
  const paginated = students.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleDelete() {
    if (!deleteId) return;
    setIsDeleting(true);

    const result = await deleteStudent(deleteId);

    if (result.success) {
      toast.success("Estudiante eliminado correctamente");
      router.refresh();
    } else {
      toast.error(result.error ?? "Error al eliminar el estudiante");
    }

    setDeleteId(null);
    setIsDeleting(false);
  }

  if (students.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg font-medium">No hay estudiantes registrados</p>
        <p className="text-sm mt-1">
          Haga clic en &quot;Nuevo Estudiante&quot; para agregar uno.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-semibold">Identificación</TableHead>
              <TableHead className="font-semibold">No. matrícula</TableHead>
              <TableHead className="font-semibold">Nombres</TableHead>
              <TableHead className="font-semibold">Apellidos</TableHead>
              <TableHead className="font-semibold">Grado</TableHead>
              <TableHead className="font-semibold">Estado de Pagos</TableHead>
              <TableHead className="font-semibold">Perfil de Usuario</TableHead>
              <TableHead className="font-semibold text-right">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((student) => {
              const clasesAdeudadas = Number(student.clases_adeudadas ?? 0);
              const clasesAdelantadas = Number(student.clases_adelantadas ?? 0);
              const deudaActual = Number(
                student.deuda_actual ??
                  clasesAdeudadas * Number(student.valor_apoyo_semanal ?? 0),
              );

              const estadoTexto =
                clasesAdeudadas > 0
                  ? `Debe - ${formatCurrency(deudaActual)}`
                  : clasesAdelantadas > 0
                    ? `Adelantado (${clasesAdelantadas})`
                    : "Al día";

              const estadoClassName =
                clasesAdeudadas > 0
                  ? "text-red-600 bg-red-50 border-red-200"
                  : "text-emerald-700 bg-emerald-50 border-emerald-200";

              return (
                <TableRow
                  key={student.numero_identificacion}
                  className="hover:bg-gray-50"
                >
                  <TableCell className="font-mono text-sm">
                    {student.numero_identificacion}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {student.no_matricula ?? "-"}
                  </TableCell>
                  <TableCell>{student.nombres}</TableCell>
                  <TableCell>{student.apellidos}</TableCell>
                  <TableCell>{student.grado}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoClassName}`}
                    >
                      {estadoTexto}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        student.perfil_usuario === "activo"
                          ? "default"
                          : "outline"
                      }
                    >
                      {student.perfil_usuario === "activo"
                        ? "Activo"
                        : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-600 hover:text-gray-900"
                        asChild
                      >
                        <Link
                          href={`/dashboard/students/${student.numero_identificacion}`}
                        >
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">Ver</span>
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-600 hover:text-gray-900"
                        asChild
                      >
                        <Link
                          href={`/dashboard/students/${student.numero_identificacion}/edit`}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Editar</span>
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() =>
                          setDeleteId(student.numero_identificacion)
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-3">
          <p className="text-sm text-gray-500">
            Página {page} de {totalPages} &mdash; {students.length} registros
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Anterior</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Siguiente</span>
            </Button>
          </div>
        </div>
      )}

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar estudiante?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el registro del
              estudiante de forma permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
