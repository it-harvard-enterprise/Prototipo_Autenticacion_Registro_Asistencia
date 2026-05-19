"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, ImagePlus, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface MaterialsHomeClientProps {
  courseId: number;
  courseName: string;
  canManage: boolean;
  initialCoverImageUrl: string | null;
  folders: Array<{
    id: number;
    parentFolderId: number | null;
    name: string;
    filesCount: number;
    cardImageUrl: string | null;
  }>;
  files: Array<{
    id: number;
    folderId: number;
    fileName: string;
    contentType: string | null;
    fileSize: number;
    createdAt: string;
    downloadUrl: string | null;
    youtubeUrl: string | null;
  }>;
}

export function MaterialsHomeClient({
  courseId,
  courseName,
  canManage,
  initialCoverImageUrl,
  folders,
  files,
}: MaterialsHomeClientProps) {
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(
    initialCoverImageUrl,
  );
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  const now = useMemo(() => new Date(), []);
  const recentFiles = files.slice(0, 6);
  const totalFiles = files.length;
  const parentFolders = useMemo(
    () => folders.filter((folder) => folder.parentFolderId === null),
    [folders],
  );
  const folderNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const folder of folders) {
      map.set(folder.id, folder.name);
    }
    return map;
  }, [folders]);

  async function handleCoverUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploadingCover(true);

    try {
      const formData = new FormData();
      formData.set("id_curso", String(courseId));
      formData.set("image", file);

      const response = await fetch("/api/course-materials/cover", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        data?: { cover_url?: string };
      } | null;

      if (!response.ok || !payload?.success || !payload.data?.cover_url) {
        toast.error(payload?.error ?? "No se pudo actualizar la portada");
        setIsUploadingCover(false);
        event.currentTarget.value = "";
        return;
      }

      setCoverImageUrl(payload.data.cover_url);
      toast.success("Portada actualizada correctamente.");
      setIsUploadingCover(false);
      event.currentTarget.value = "";
    } catch {
      toast.error("No se pudo actualizar la portada");
      setIsUploadingCover(false);
      event.currentTarget.value = "";
    }
  }

  function formatBytes(value: number): string {
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div
          className="relative h-56 bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-700"
          style={
            coverImageUrl
              ? {
                  backgroundImage: `url(${coverImageUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10" />

          {canManage ? (
            <div className="absolute right-4 top-4 z-10">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/90 px-3 py-2 text-xs font-medium text-gray-900 hover:bg-white">
                {isUploadingCover ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                {isUploadingCover
                  ? "Subiendo portada..."
                  : "Subir imagen de fondo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverUpload}
                  disabled={isUploadingCover}
                />
              </label>
            </div>
          ) : null}

          <div className="absolute bottom-5 left-5 z-10">
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              {courseName}
            </h1>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm uppercase tracking-wide text-gray-500">
            Carpetas
          </h2>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {folders.length}
          </p>
        </article>
        <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm uppercase tracking-wide text-gray-500">
            Archivos
          </h2>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {totalFiles}
          </p>
        </article>
        <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm uppercase tracking-wide text-gray-500">
            Fecha actual
          </h2>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            {now.toLocaleDateString("es-CO", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Archivos recientes
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Materiales subidos recientemente para este curso.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/dashboard/courses/${courseId}/materials/content`}>
              Ir al gestor de contenido
            </Link>
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {recentFiles.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              Aún no hay archivos cargados para este curso.
            </p>
          ) : (
            recentFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {file.fileName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {file.contentType === "video/youtube"
                      ? "Video de YouTube"
                      : formatBytes(file.fileSize)}{" "}
                    · {new Date(file.createdAt).toLocaleDateString("es-CO")}
                  </p>
                </div>
                {file.youtubeUrl ? (
                  <a
                    href={file.youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver video
                  </a>
                ) : null}
                {file.downloadUrl ? (
                  <a
                    href={file.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    Abrir
                  </a>
                ) : !file.youtubeUrl ? (
                  <span className="text-xs text-gray-400">Sin URL</span>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Carpetas</h2>
        <p className="text-sm text-gray-600">
          Organización de carpetas principales para {courseName}.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {parentFolders.map((folder) => (
            <article
              key={folder.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <Link
                href={`/dashboard/courses/${courseId}/materials/folders/${folder.id}`}
              >
                <div className="mb-3 h-24 overflow-hidden rounded-lg border border-gray-200 bg-gradient-to-br from-slate-100 via-slate-50 to-white">
                  {folder.cardImageUrl ? (
                    <img
                      src={folder.cardImageUrl}
                      alt={`Imagen de la carpeta ${folder.name}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-gray-400">
                      Sin imagen
                    </div>
                  )}
                </div>
              </Link>
              <p className="text-sm font-medium text-gray-900">
                <Link
                  href={`/dashboard/courses/${courseId}/materials/folders/${folder.id}`}
                  className="hover:text-cyan-700"
                >
                  {folder.name}
                </Link>
              </p>
              {folder.parentFolderId ? (
                <p className="mt-1 text-xs text-cyan-700">
                  Subcarpeta de{" "}
                  {folderNameById.get(folder.parentFolderId) ?? "-"}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-gray-600">
                {folder.filesCount} archivo(s)
              </p>
            </article>
          ))}
          {parentFolders.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600 sm:col-span-2 xl:col-span-3">
              No hay carpetas padre creadas todavía.
            </p>
          ) : null}
        </div>
      </section>

      {!canManage ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Solo administradores y profesores pueden cargar o eliminar materiales.
        </div>
      ) : null}
    </div>
  );
}
