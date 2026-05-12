"use client";

import { useMemo, useState } from "react";
import { FolderPlus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CourseFolder,
  computeCompletion,
} from "@/lib/course-materials/mock-data";
import { FolderCard } from "@/components/course-materials/folder-card";

interface MaterialsContentClientProps {
  canManage: boolean;
  initialFolders: CourseFolder[];
}

export function MaterialsContentClient({
  canManage,
  initialFolders,
}: MaterialsContentClientProps) {
  const [folders, setFolders] = useState<CourseFolder[]>(initialFolders);
  const [newFolderName, setNewFolderName] = useState("");

  const totalFiles = useMemo(
    () => folders.reduce((acc, folder) => acc + folder.fileCount, 0),
    [folders],
  );

  const averageCompletion = useMemo(() => {
    if (folders.length === 0) return 0;
    const total = folders.reduce(
      (acc, folder) =>
        acc + computeCompletion(folder.visitedCount, folder.fileCount),
      0,
    );
    return Math.round(total / folders.length);
  }, [folders]);

  const addFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;

    const colors = [
      "from-amber-300 to-orange-500",
      "from-sky-300 to-blue-500",
      "from-emerald-300 to-green-500",
      "from-fuchsia-300 to-pink-500",
      "from-violet-300 to-indigo-500",
    ];

    setFolders((prev) => [
      {
        id: `local-folder-${Date.now()}`,
        name,
        fileCount: 0,
        visitedCount: 0,
        colorClass: colors[prev.length % colors.length],
      },
      ...prev,
    ]);
    setNewFolderName("");
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          Resumen de Contenido
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Carpetas
            </p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {folders.length}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Archivos
            </p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {totalFiles}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Progreso promedio
            </p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {averageCompletion}%
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
            Solo administradores y profesores pueden crear carpetas y cargar
            archivos.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <Input
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="Ejemplo: Unidad 3 - Talleres"
            />
            <Button onClick={addFolder} disabled={!newFolderName.trim()}>
              <FolderPlus className="mr-2 h-4 w-4" />
              Crear carpeta
            </Button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {folders.map((folder) => (
          <div key={folder.id} className="space-y-3">
            <FolderCard folder={folder} large showUploadHint={canManage} />

            {canManage ? (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <Upload className="h-4 w-4" />
                Subir archivos a esta carpeta
                <input type="file" multiple className="hidden" />
              </label>
            ) : null}
          </div>
        ))}
      </section>
    </div>
  );
}
