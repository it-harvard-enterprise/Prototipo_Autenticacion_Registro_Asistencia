import Link from "next/link";
import { Plus } from "lucide-react";
import { getAdmins } from "@/app/actions/admins";
import { AdminsTable } from "@/components/admins-table";
import { Button } from "@/components/ui/button";
import { Admin } from "@/app/actions/admins";

export default async function AdminsPage() {
  const result = await getAdmins();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administradores</h1>
          <p className="text-gray-500 mt-1">
            Gestión de administradores del sistema
          </p>
        </div>
        <Button asChild className="bg-[#b92f2d] hover:bg-[#982725] text-white">
          <Link href="/dashboard/admins/create">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Administrador
          </Link>
        </Button>
      </div>

      {!result.success ? (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">
            Error al cargar los administradores: {result.error}
          </p>
        </div>
      ) : (
        <AdminsTable admins={(result.data ?? []) as Admin[]} />
      )}
    </div>
  );
}
