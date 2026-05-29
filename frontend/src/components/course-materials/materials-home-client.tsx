"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface MaterialsHomeClientProps {
  courseId: number;
  courseName: string;
  canManage: boolean;
  currentRole: string | null;
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

const MAX_COVER_IMAGE_BYTES = 10 * 1024 * 1024;
const DEFAULT_COVER_POSITION = 50;

function clampCoverPosition(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_COVER_POSITION;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeHttpImageUrl(rawValue: string): string | null {
  try {
    const parsed = new URL(rawValue.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function MaterialsHomeClient({
  courseId,
  courseName,
  canManage,
  currentRole,
  initialCoverImageUrl,
  folders,
  files,
}: MaterialsHomeClientProps) {
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(
    initialCoverImageUrl,
  );
  const [coverImageSourceMode, setCoverImageSourceMode] = useState<
    "upload" | "url"
  >("upload");
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isSavingCoverUrl, setIsSavingCoverUrl] = useState(false);
  const [coverImageUrlInput, setCoverImageUrlInput] = useState("");
  const [coverPositionX, setCoverPositionX] = useState(DEFAULT_COVER_POSITION);
  const [coverPositionY, setCoverPositionY] = useState(DEFAULT_COVER_POSITION);
  const [isCoverFramingOpen, setIsCoverFramingOpen] = useState(false);
  const [coverDraftPositionX, setCoverDraftPositionX] = useState(
    DEFAULT_COVER_POSITION,
  );
  const [coverDraftPositionY, setCoverDraftPositionY] = useState(
    DEFAULT_COVER_POSITION,
  );
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const coverDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startPositionX: number;
    startPositionY: number;
    width: number;
    height: number;
  } | null>(null);

  const now = useMemo(() => new Date(), []);
  const totalFiles = files.length;
  const parentFolders = useMemo(
    () => folders.filter((folder) => folder.parentFolderId === null),
    [folders],
  );
  const subfolderCountByParent = useMemo(() => {
    const counts = new Map<number, number>();

    for (const folder of folders) {
      if (folder.parentFolderId === null) {
        continue;
      }

      counts.set(
        folder.parentFolderId,
        (counts.get(folder.parentFolderId) ?? 0) + 1,
      );
    }

    return counts;
  }, [folders]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storageKey = `course-cover-position:${courseId}`;
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return;
    }

    try {
      const parsed = JSON.parse(rawValue) as { x?: number; y?: number };
      setCoverPositionX(clampCoverPosition(parsed.x ?? DEFAULT_COVER_POSITION));
      setCoverPositionY(clampCoverPosition(parsed.y ?? DEFAULT_COVER_POSITION));
    } catch {
      // Ignore malformed local preferences.
    }
  }, [courseId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storageKey = `course-cover-position:${courseId}`;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        x: clampCoverPosition(coverPositionX),
        y: clampCoverPosition(coverPositionY),
      }),
    );
  }, [courseId, coverPositionX, coverPositionY]);

  async function handleCoverUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const inputElement = event.currentTarget;
    const file = inputElement.files?.[0];
    const resetInput = () => {
      try {
        inputElement.value = "";
      } catch {
        // Ignore input reset edge cases after async flow.
      }
    };

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen.");
      resetInput();
      return;
    }

    if (file.size > MAX_COVER_IMAGE_BYTES) {
      toast.error(
        `La imagen pesa ${formatBytes(file.size)} y supera el límite de ${formatBytes(MAX_COVER_IMAGE_BYTES)}.`,
      );
      resetInput();
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
        return;
      }

      setCoverImageUrl(payload.data.cover_url);
      toast.success("Portada actualizada correctamente.");
    } catch {
      toast.error("No se pudo actualizar la portada");
    } finally {
      setIsUploadingCover(false);
      resetInput();
    }
  }

  async function handleCoverUrlSave() {
    const normalizedUrl = normalizeHttpImageUrl(coverImageUrlInput);
    if (!normalizedUrl) {
      toast.error("Debe ingresar una URL válida con http:// o https://");
      return;
    }

    setIsSavingCoverUrl(true);

    try {
      const response = await fetch("/api/course-materials/cover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_curso: courseId,
          image_url: normalizedUrl,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        data?: { cover_url?: string };
      } | null;

      if (!response.ok || !payload?.success || !payload.data?.cover_url) {
        toast.error(payload?.error ?? "No se pudo actualizar la portada");
        setIsSavingCoverUrl(false);
        return;
      }

      setCoverImageUrl(payload.data.cover_url);
      setCoverImageUrlInput("");
      toast.success("Portada actualizada correctamente.");
      setIsSavingCoverUrl(false);
    } catch {
      toast.error("No se pudo actualizar la portada");
      setIsSavingCoverUrl(false);
    }
  }

  function openCoverFraming() {
    setCoverDraftPositionX(coverPositionX);
    setCoverDraftPositionY(coverPositionY);
    setIsCoverFramingOpen(true);
  }

  function closeCoverFraming() {
    setIsCoverFramingOpen(false);
    setIsDraggingCover(false);
    coverDragRef.current = null;
  }

  function confirmCoverFraming() {
    setCoverPositionX(clampCoverPosition(coverDraftPositionX));
    setCoverPositionY(clampCoverPosition(coverDraftPositionY));
    closeCoverFraming();
    toast.success("Encuadre de portada guardado.");
  }

  function handleCoverPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!isCoverFramingOpen) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    coverDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPositionX: coverDraftPositionX,
      startPositionY: coverDraftPositionY,
      width: Math.max(bounds.width, 1),
      height: Math.max(bounds.height, 1),
    };

    setIsDraggingCover(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCoverPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const dragState = coverDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaXPercent =
      ((event.clientX - dragState.startX) / dragState.width) * 100;
    const deltaYPercent =
      ((event.clientY - dragState.startY) / dragState.height) * 100;

    setCoverDraftPositionX(
      clampCoverPosition(dragState.startPositionX + deltaXPercent),
    );
    setCoverDraftPositionY(
      clampCoverPosition(dragState.startPositionY + deltaYPercent),
    );
  }

  function handleCoverPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    const dragState = coverDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    coverDragRef.current = null;
    setIsDraggingCover(false);
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div
          className="relative h-96 bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-700"
          style={
            coverImageUrl
              ? {
                  backgroundImage: `url(${coverImageUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: `${
                    isCoverFramingOpen ? coverDraftPositionX : coverPositionX
                  }% ${isCoverFramingOpen ? coverDraftPositionY : coverPositionY}%`,
                }
              : undefined
          }
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10" />

          {canManage && coverImageUrl && isCoverFramingOpen ? (
            <div
              className={`absolute inset-0 z-[5] ${
                isDraggingCover ? "cursor-grabbing" : "cursor-grab"
              }`}
              onPointerDown={handleCoverPointerDown}
              onPointerMove={handleCoverPointerMove}
              onPointerUp={handleCoverPointerEnd}
              onPointerCancel={handleCoverPointerEnd}
            >
              <div className="pointer-events-none absolute inset-0 border-2 border-white/60" />
            </div>
          ) : null}

          {canManage ? (
            <div className="absolute right-4 top-4 z-10 space-y-2">
              <div className="flex items-start justify-end gap-2">
                <div className="space-y-2 rounded-xl bg-white/90 p-2 backdrop-blur">
                  <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
                    <button
                      type="button"
                      onClick={() => setCoverImageSourceMode("upload")}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                        coverImageSourceMode === "upload"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Desde archivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoverImageSourceMode("url")}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                        coverImageSourceMode === "url"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Desde URL
                    </button>
                  </div>

                  {coverImageSourceMode === "upload" ? (
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50">
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
                  ) : (
                    <div className="flex w-72 items-center gap-2">
                      <input
                        type="url"
                        value={coverImageUrlInput}
                        onChange={(event) =>
                          setCoverImageUrlInput(event.target.value)
                        }
                        placeholder="https://imagen-ejemplo.com/portada.jpg"
                        className="h-8 min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 outline-none placeholder:text-gray-400 focus:border-red-400"
                      />
                      <button
                        type="button"
                        onClick={() => void handleCoverUrlSave()}
                        disabled={
                          isSavingCoverUrl || !coverImageUrlInput.trim()
                        }
                        className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-[#b92f2d] px-2 text-xs font-medium text-white hover:bg-[#982725] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSavingCoverUrl ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Usar URL"
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-gray-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    if (isCoverFramingOpen) {
                      closeCoverFraming();
                    } else {
                      openCoverFraming();
                    }
                  }}
                  disabled={!coverImageUrl}
                  aria-label="Abrir selector de encuadre"
                  aria-pressed={isCoverFramingOpen}
                  title={
                    coverImageUrl
                      ? "Ajustar encuadre"
                      : "Suba una imagen para ajustar el encuadre"
                  }
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}

          {canManage && coverImageUrl && isCoverFramingOpen ? (
            <div className="absolute bottom-4 right-4 z-10 w-72 rounded-xl bg-white/90 p-3 shadow-sm backdrop-blur">
              <p className="text-xs font-semibold text-gray-900">
                Encuadre de portada
              </p>
              <div className="mt-2 space-y-2">
                <p className="text-[11px] text-gray-600">
                  Mantén presionada la imagen y arrastra para ajustar el área
                  visible.
                </p>
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCoverDraftPositionX(DEFAULT_COVER_POSITION);
                      setCoverDraftPositionY(DEFAULT_COVER_POSITION);
                    }}
                  >
                    Centrar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-2"
                    onClick={closeCoverFraming}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="ml-2 bg-[#b92f2d] text-white hover:bg-[#982725]"
                    onClick={confirmCoverFraming}
                  >
                    Hecho
                  </Button>
                </div>
              </div>
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Carpetas</h2>
        <p className="text-sm text-gray-600">
          Organización de carpetas principales para {courseName}.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {parentFolders.map((folder) => {
            const subfoldersCount = subfolderCountByParent.get(folder.id) ?? 0;

            return (
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
                      <div className="flex h-full items-center justify-center text-xs text-gray-400">
                        Sin imagen
                      </div>
                    )}
                  </div>
                </Link>
                <p className="text-sm font-medium text-gray-900">
                  <Link
                    href={`/dashboard/courses/${courseId}/materials/folders/${folder.id}`}
                    className="hover:text-red-700"
                  >
                    {folder.name}
                  </Link>
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  {subfoldersCount} subcarpeta(s)
                </p>
              </article>
            );
          })}
          {parentFolders.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600 sm:col-span-2 xl:col-span-3">
              No hay carpetas padre creadas todavía.
            </p>
          ) : null}
        </div>
      </section>

      {!canManage && currentRole !== "estudiante" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Solo administradores y profesores pueden cargar o eliminar materiales.
        </div>
      ) : null}
    </div>
  );
}
