"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, UserX } from "lucide-react";
import { toast } from "sonner";

import {
  createProfessorUserProfile,
  deleteProfessorUserProfile,
} from "@/app/actions/professors";
import {
  createStudentUserProfile,
  deleteStudentUserProfile,
} from "@/app/actions/students";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type EntityType = "estudiante" | "profesor";

interface UserProfileActionsProps {
  entityType: EntityType;
  numeroIdentificacion: string;
  email?: string | null;
  profileStatus?: "activo" | "inactivo";
}

export function UserProfileActions({
  entityType,
  numeroIdentificacion,
  email,
  profileStatus = "inactivo",
}: UserProfileActionsProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const isActive = profileStatus === "activo";
  const title = entityType === "estudiante" ? "estudiante" : "profesor";

  async function handleCreateProfile() {
    if (!email || email.trim() === "") {
      toast.error("No hay correo electrónico para crear el usuario");
      return;
    }

    setIsProcessing(true);
    const result =
      entityType === "estudiante"
        ? await createStudentUserProfile(numeroIdentificacion)
        : await createProfessorUserProfile(numeroIdentificacion);
    setIsProcessing(false);

    if (!result.success) {
      toast.error(result.error ?? "No fue posible crear el perfil del usuario");
      return;
    }

    router.refresh();
    toast.success("Perfil de usuario creado correctamente");
  }

  async function handleDeleteProfile() {
    setIsProcessing(true);
    const result =
      entityType === "estudiante"
        ? await deleteStudentUserProfile(numeroIdentificacion)
        : await deleteProfessorUserProfile(numeroIdentificacion);
    setIsProcessing(false);
    setIsDeleteOpen(false);

    if (!result.success) {
      toast.error(result.error ?? "No fue posible eliminar el perfil");
      return;
    }

    router.refresh();
    toast.success("Perfil de usuario eliminado correctamente");
  }

  return (
    <>
      <div className="rounded-md border bg-white p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-800">Perfil de Usuario</p>
          <p className="text-xs text-gray-500 mt-1">
            Estado del perfil vinculado al {title} para autenticación en la
            aplicación.
          </p>
          <div className="mt-2">
            <Badge variant={isActive ? "default" : "outline"}>
              {isActive ? "Activo" : "Inactivo"}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {isActive ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setIsDeleteOpen(true)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <UserX className="mr-2 h-4 w-4" />
                  Eliminar perfil
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              className="bg-[#b92f2d] hover:bg-[#982725] text-white"
              onClick={handleCreateProfile}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Crear usuario
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar perfil de usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto eliminará únicamente el registro en la tabla profiles. El{" "}
              {title} no será borrado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={handleDeleteProfile}
              disabled={isProcessing}
            >
              {isProcessing ? "Eliminando..." : "Eliminar perfil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
