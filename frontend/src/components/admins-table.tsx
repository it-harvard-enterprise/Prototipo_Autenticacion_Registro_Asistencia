"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Admin, deleteAdmin } from "@/app/actions/admins";
import { Button } from "@/components/ui/button";
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

interface AdminsTableProps {
  admins: Admin[];
}

const PAGE_SIZE = 10;

export function AdminsTable({ admins }: AdminsTableProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(admins.length / PAGE_SIZE));
  const paginated = admins.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleDelete() {
    if (!deleteId) return;
    setIsDeleting(true);

    const result = await deleteAdmin(deleteId);

    if (result.success) {
      toast.success("Administrador eliminado correctamente");
      router.refresh();
    } else {
      toast.error(result.error ?? "Error al eliminar el administrador");
    }

    setDeleteId(null);
    setIsDeleting(false);
  }

  if (admins.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg font-medium">
          No hay administradores registrados
        </p>
        <p className="text-sm mt-1">
          Haga clic en &quot;Nuevo Administrador&quot; para agregar uno.
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
              <TableHead className="font-semibold">Nombres</TableHead>
              <TableHead className="font-semibold">Apellidos</TableHead>
              <TableHead className="font-semibold">
                Correo Electrónico
              </TableHead>
              <TableHead className="font-semibold">Tipo ID</TableHead>
              <TableHead className="font-semibold text-right">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((admin) => (
              <TableRow key={admin.id} className="hover:bg-gray-50">
                <TableCell className="font-mono text-sm">
                  {admin.numero_identificacion}
                </TableCell>
                <TableCell>{admin.nombres}</TableCell>
                <TableCell>{admin.apellidos}</TableCell>
                <TableCell className="text-sm">{admin.email}</TableCell>
                <TableCell className="text-sm text-gray-600">
                  {admin.tipo_identificacion}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-600 hover:text-gray-900"
                      asChild
                    >
                      <Link href={`/dashboard/admins/${admin.id}`}>
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
                      <Link href={`/dashboard/admins/${admin.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Editar</span>
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeleteId(admin.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Eliminar</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-gray-600">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
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
            <AlertDialogTitle>Eliminar Administrador</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea eliminar este administrador? Esta acción
              no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
