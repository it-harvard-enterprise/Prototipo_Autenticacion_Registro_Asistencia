"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FolderPlus, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MaterialsContentClientProps {
  courseId: number;
  canManage: boolean;
  initialFolders: Array<{
    id: number;
    parentFolderId: number | null;
    name: string;
    filesCount: number;
    cardImageUrl: string | null;
  }>;
}

export function MaterialsContentClient({
  courseId,
  canManage,
  initialFolders,
}: MaterialsContentClientProps) {
  const [folders, setFolders] = useState(initialFolders);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const parentFolders = useMemo(() => {
    return [...folders]
      .filter((folder) => folder.parentFolderId === null)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [folders]);

  async function addFolder() {
    const name = newFolderName.trim();
    if (!name) {
      return;
    }

    setIsCreatingFolder(true);

    try {
      const response = await fetch("/api/course-materials/folders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_curso: courseId,
          parent_folder_id: null,
          name,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        data?: {
          id: number;
          id_curso: number;
          parent_folder_id: number | null;
          name: string;
          created_at: string;
          updated_at: string;
        };
      } | null;

      if (!response.ok || !payload?.success || !payload.data) {
        toast.error(payload?.error ?? "No se pudo crear la carpeta");
        setIsCreatingFolder(false);
        return;
      }

      setFolders((prev) => [
        {
          id: payload.data!.id,
          parentFolderId: payload.data!.parent_folder_id,
          name: payload.data!.name,
          filesCount: 0,
          cardImageUrl: null,
        },
        ...prev,
      ]);
      setNewFolderName("");
      toast.success("Carpeta creada correctamente.");
      setIsCreatingFolder(false);
    } catch {
      toast.error("No se pudo crear la carpeta");
      setIsCreatingFolder(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Carpetas padre</h2>
        <p className="mt-1 text-sm text-gray-600">
          Aquí solo se muestran carpetas principales. Para crear subcarpetas,
          subir archivos y agregar enlaces de YouTube, abra una carpeta.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Carpetas padre
            </p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {parentFolders.length}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Total carpetas
            </p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {folders.length}
            </p>
          </div>
        </div>
      </section>

      {canManage ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">
            Crear nueva carpeta
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Esta acción crea solo una carpeta padre.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <Input
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="Ejemplo: Unidad 3 - Talleres"
            />
            <Button
              onClick={addFolder}
              disabled={!newFolderName.trim() || isCreatingFolder}
            >
              {isCreatingFolder ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FolderPlus className="mr-2 h-4 w-4" />
              )}
              {isCreatingFolder ? "Creando..." : "Crear carpeta"}
            </Button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {parentFolders.map((folder) => (
          <article
            key={folder.id}
            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-red-700"
          >
            <Link
              href={`/dashboard/courses/${courseId}/materials/folders/${folder.id}`}
            >
              <div className="mb-3 h-28 overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-slate-100 via-slate-50 to-white">
                {folder.cardImageUrl ? (
                  <img
                    src={folder.cardImageUrl}
                    alt={`Imagen de la carpeta ${folder.name}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-400">
                    <ImagePlus className="h-5 w-5" />
                  </div>
                )}
              </div>
            </Link>

            <h3 className="text-base font-semibold text-gray-900">
              <Link
                href={`/dashboard/courses/${courseId}/materials/folders/${folder.id}`}
                className="hover:text-red-700"
              >
                {folder.name}
              </Link>
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {folder.filesCount} archivo(s)
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Abra esta carpeta para gestionar subcarpetas, archivos y enlaces.
            </p>
          </article>
        ))}

        {parentFolders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600 sm:col-span-2 xl:col-span-3">
            No hay carpetas padre de materiales para este curso.
          </div>
        ) : null}
      </section>
    </div>
  );
}
