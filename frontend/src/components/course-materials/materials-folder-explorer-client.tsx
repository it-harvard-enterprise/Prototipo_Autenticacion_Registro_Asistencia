"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Folder,
  FolderPlus,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Pencil,
  PlayCircle,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface FolderExplorerFolder {
  id: number;
  parentFolderId: number | null;
  name: string;
  filesCount: number;
  cardImageUrl: string | null;
}

interface FolderExplorerFile {
  id: number;
  folderId: number;
  fileName: string;
  contentType: string | null;
  fileSize: number;
  createdAt: string;
  downloadUrl: string | null;
  youtubeUrl: string | null;
}

interface MaterialsFolderExplorerClientProps {
  courseId: number;
  canManage: boolean;
  initialFolderId: number;
  folders: FolderExplorerFolder[];
  files: FolderExplorerFile[];
}

const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_UPLOAD_BATCH_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_CARD_IMAGE_BYTES = 10 * 1024 * 1024;

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function extractYouTubeId(rawUrl: string | null): string | null {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      return id || null;
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }

      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.replace("/shorts/", "").split("/")[0] ?? null;
      }

      if (parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.replace("/embed/", "").split("/")[0] ?? null;
      }
    }
  } catch {
    return null;
  }

  return null;
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

export function MaterialsFolderExplorerClient({
  courseId,
  canManage,
  initialFolderId,
  folders: initialFolders,
  files: initialFiles,
}: MaterialsFolderExplorerClientProps) {
  const router = useRouter();
  const [folders, setFolders] = useState(initialFolders);
  const [files, setFiles] = useState(initialFiles);
  const [selectedFolderId, setSelectedFolderId] = useState(initialFolderId);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(
    () => new Set([initialFolderId]),
  );
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [newSubfolderName, setNewSubfolderName] = useState("");
  const [isCreatingSubfolder, setIsCreatingSubfolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<number | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [savingFolderId, setSavingFolderId] = useState<number | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<number | null>(null);
  const [uploadingFolderId, setUploadingFolderId] = useState<number | null>(
    null,
  );
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);
  const [uploadingCardFolderId, setUploadingCardFolderId] = useState<
    number | null
  >(null);
  const [folderCardImageSourceMode, setFolderCardImageSourceMode] = useState<
    "upload" | "url"
  >("upload");
  const [savingCardUrlFolderId, setSavingCardUrlFolderId] = useState<
    number | null
  >(null);
  const [cardImageUrlInput, setCardImageUrlInput] = useState("");
  const [youtubeUrlInput, setYoutubeUrlInput] = useState("");
  const [youtubeTitleInput, setYoutubeTitleInput] = useState("");
  const [creatingYoutubeFolderId, setCreatingYoutubeFolderId] = useState<
    number | null
  >(null);
  const [pendingFolderDelete, setPendingFolderDelete] = useState<{
    folder: FolderExplorerFolder;
    nestedCount: number;
    filesInBranch: number;
  } | null>(null);

  const folderById = useMemo(() => {
    const map = new Map<number, FolderExplorerFolder>();
    for (const folder of folders) {
      map.set(folder.id, folder);
    }
    return map;
  }, [folders]);

  const childrenByParent = useMemo(() => {
    const map = new Map<number | null, FolderExplorerFolder[]>();
    for (const folder of folders) {
      const list = map.get(folder.parentFolderId) ?? [];
      list.push(folder);
      map.set(folder.parentFolderId, list);
    }

    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return map;
  }, [folders]);

  const rootFolder = folderById.get(initialFolderId) ?? null;

  const filesByFolder = useMemo(() => {
    const map = new Map<number, FolderExplorerFile[]>();
    for (const file of files) {
      const list = map.get(file.folderId) ?? [];
      list.push(file);
      map.set(file.folderId, list);
    }

    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    return map;
  }, [files]);

  const selectedFolder = folderById.get(selectedFolderId) ?? rootFolder;
  const selectedFolderFiles = selectedFolder
    ? (filesByFolder.get(selectedFolder.id) ?? [])
    : [];
  const selectedSubfolderCount = selectedFolder
    ? (childrenByParent.get(selectedFolder.id)?.length ?? 0)
    : 0;

  const resolvedSelectedFileId = selectedFolderFiles.some(
    (file) => file.id === selectedFileId,
  )
    ? selectedFileId
    : (selectedFolderFiles[0]?.id ?? null);

  const selectedFile =
    selectedFolderFiles.find((file) => file.id === resolvedSelectedFileId) ??
    null;

  function collectFolderBranchIds(rootFolderId: number): number[] {
    const collected = new Set<number>([rootFolderId]);
    const queue: number[] = [rootFolderId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = childrenByParent.get(current) ?? [];
      for (const child of children) {
        if (!collected.has(child.id)) {
          collected.add(child.id);
          queue.push(child.id);
        }
      }
    }

    return Array.from(collected);
  }

  function toggleFolder(folderId: number) {
    setExpandedFolderIds((previous) => {
      const next = new Set(previous);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  function handleSelectFolder(folderId: number) {
    setSelectedFolderId(folderId);
    setExpandedFolderIds((previous) => {
      if (previous.has(folderId)) {
        return previous;
      }
      const next = new Set(previous);
      next.add(folderId);
      return next;
    });
  }

  function startFolderRename(folder: FolderExplorerFolder) {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  }

  function cancelFolderRename() {
    setEditingFolderId(null);
    setEditingFolderName("");
  }

  async function submitFolderRename(folder: FolderExplorerFolder) {
    const name = editingFolderName.trim();
    if (!name) {
      toast.error("El nombre de la carpeta es obligatorio");
      return;
    }

    if (name === folder.name) {
      cancelFolderRename();
      return;
    }

    setSavingFolderId(folder.id);

    try {
      const response = await fetch("/api/course-materials/folders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_curso: courseId,
          folder_id: folder.id,
          name,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        data?: {
          id: number;
          parent_folder_id: number | null;
          name: string;
        };
      } | null;

      if (!response.ok || !payload?.success || !payload.data) {
        toast.error(payload?.error ?? "No se pudo actualizar la carpeta");
        setSavingFolderId(null);
        return;
      }

      setFolders((prev) =>
        prev.map((currentFolder) =>
          currentFolder.id === folder.id
            ? {
                ...currentFolder,
                name: payload.data?.name ?? name,
              }
            : currentFolder,
        ),
      );
      toast.success("Nombre de carpeta actualizado correctamente.");
      setSavingFolderId(null);
      cancelFolderRename();
    } catch {
      toast.error("No se pudo actualizar la carpeta");
      setSavingFolderId(null);
    }
  }

  async function createSubfolder() {
    const name = newSubfolderName.trim();
    if (!selectedFolder || !name) {
      return;
    }

    setIsCreatingSubfolder(true);

    try {
      const response = await fetch("/api/course-materials/folders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_curso: courseId,
          parent_folder_id: selectedFolder.id,
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
        toast.error(payload?.error ?? "No se pudo crear la subcarpeta");
        setIsCreatingSubfolder(false);
        return;
      }

      setFolders((prev) => [
        {
          id: payload.data.id,
          parentFolderId: payload.data.parent_folder_id,
          name: payload.data.name,
          filesCount: 0,
          cardImageUrl: null,
        },
        ...prev,
      ]);
      setExpandedFolderIds((prev) => {
        const next = new Set(prev);
        next.add(selectedFolder.id);
        return next;
      });
      setNewSubfolderName("");
      toast.success("Subcarpeta creada correctamente.");
      setIsCreatingSubfolder(false);
    } catch {
      toast.error("No se pudo crear la subcarpeta");
      setIsCreatingSubfolder(false);
    }
  }

  async function uploadFolderCard(folderId: number, fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen.");
      return;
    }

    if (file.size > MAX_CARD_IMAGE_BYTES) {
      toast.error(
        `La imagen pesa ${formatBytes(file.size)} y supera el límite de ${formatBytes(MAX_CARD_IMAGE_BYTES)}.`,
      );
      return;
    }

    setUploadingCardFolderId(folderId);

    try {
      const formData = new FormData();
      formData.set("id_curso", String(courseId));
      formData.set("image", file);

      const response = await fetch(
        `/api/course-materials/folders/${folderId}/card`,
        {
          method: "POST",
          body: formData,
        },
      );

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        data?: {
          card_url?: string;
        };
      } | null;

      if (!response.ok || !payload?.success || !payload.data?.card_url) {
        toast.error(payload?.error ?? "No se pudo actualizar la imagen");
        setUploadingCardFolderId(null);
        return;
      }

      setFolders((prev) =>
        prev.map((folder) =>
          folder.id === folderId
            ? {
                ...folder,
                cardImageUrl: payload.data?.card_url ?? null,
              }
            : folder,
        ),
      );
      toast.success("Imagen de carpeta actualizada correctamente.");
      setUploadingCardFolderId(null);
    } catch {
      toast.error("No se pudo actualizar la imagen");
      setUploadingCardFolderId(null);
    }
  }

  async function setFolderCardUrl(folderId: number) {
    const normalizedUrl = normalizeHttpImageUrl(cardImageUrlInput);
    if (!normalizedUrl) {
      toast.error("Debe ingresar una URL válida con http:// o https://");
      return;
    }

    setSavingCardUrlFolderId(folderId);

    try {
      const response = await fetch(
        `/api/course-materials/folders/${folderId}/card`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id_curso: courseId,
            image_url: normalizedUrl,
          }),
        },
      );

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        data?: {
          card_url?: string;
        };
      } | null;

      if (!response.ok || !payload?.success || !payload.data?.card_url) {
        toast.error(payload?.error ?? "No se pudo actualizar la imagen");
        setSavingCardUrlFolderId(null);
        return;
      }

      setFolders((prev) =>
        prev.map((folder) =>
          folder.id === folderId
            ? {
                ...folder,
                cardImageUrl: payload.data?.card_url ?? null,
              }
            : folder,
        ),
      );
      setCardImageUrlInput("");
      toast.success("Imagen de carpeta actualizada correctamente.");
      setSavingCardUrlFolderId(null);
    } catch {
      toast.error("No se pudo actualizar la imagen");
      setSavingCardUrlFolderId(null);
    }
  }

  async function uploadFiles(folderId: number, fileList: FileList | null) {
    const selectedFiles = fileList ? Array.from(fileList) : [];
    if (selectedFiles.length === 0) {
      return;
    }

    const oversizedFile = selectedFiles.find(
      (file) => file.size > MAX_FILE_BYTES,
    );
    if (oversizedFile) {
      toast.error(
        `El archivo ${oversizedFile.name} pesa ${formatBytes(oversizedFile.size)} y supera el límite de ${formatBytes(MAX_FILE_BYTES)}.`,
      );
      return;
    }

    const totalBytes = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_UPLOAD_BATCH_BYTES) {
      toast.error(
        `La carga seleccionada pesa ${formatBytes(totalBytes)} y supera el límite total de ${formatBytes(MAX_UPLOAD_BATCH_BYTES)} por envío.`,
      );
      return;
    }

    setUploadingFolderId(folderId);

    try {
      const formData = new FormData();
      formData.set("id_curso", String(courseId));
      formData.set("folder_id", String(folderId));

      for (const file of selectedFiles) {
        formData.append("files", file);
      }

      const response = await fetch("/api/course-materials/files/upload", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        data?: Array<{
          id: number;
          folder_id: number;
          file_name: string;
          content_type: string | null;
          file_size: number;
          created_at: string;
          download_url: string | null;
          youtube_url?: string | null;
        }>;
      } | null;

      if (!response.ok || !payload?.success || !payload.data) {
        toast.error(payload?.error ?? "No se pudieron subir los archivos");
        setUploadingFolderId(null);
        return;
      }

      const inserted = payload.data.map((row) => ({
        id: row.id,
        folderId: row.folder_id,
        fileName: row.file_name,
        contentType: row.content_type,
        fileSize: row.file_size,
        createdAt: row.created_at,
        downloadUrl: row.download_url,
        youtubeUrl: row.youtube_url ?? null,
      }));

      setFiles((prev) => [...inserted, ...prev]);
      setFolders((prev) =>
        prev.map((folder) =>
          folder.id === folderId
            ? {
                ...folder,
                filesCount: folder.filesCount + inserted.length,
              }
            : folder,
        ),
      );

      toast.success(`${inserted.length} archivo(s) cargado(s) correctamente.`);
      setUploadingFolderId(null);
    } catch {
      toast.error("No se pudieron subir los archivos");
      setUploadingFolderId(null);
    }
  }

  async function createYouTubeLink(folderId: number) {
    const youtubeUrl = youtubeUrlInput.trim();
    const title = youtubeTitleInput.trim();
    if (!youtubeUrl) {
      toast.error("Debe ingresar un enlace de YouTube");
      return;
    }

    setCreatingYoutubeFolderId(folderId);

    try {
      const response = await fetch("/api/course-materials/files/youtube", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_curso: courseId,
          folder_id: folderId,
          url: youtubeUrl,
          title,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        data?: {
          id: number;
          folder_id: number;
          file_name: string;
          content_type: string | null;
          file_size: number;
          created_at: string;
          youtube_url?: string | null;
        };
      } | null;

      if (!response.ok || !payload?.success || !payload.data) {
        toast.error(
          payload?.error ?? "No se pudo guardar el enlace de YouTube",
        );
        setCreatingYoutubeFolderId(null);
        return;
      }

      setFiles((prev) => [
        {
          id: payload.data.id,
          folderId: payload.data.folder_id,
          fileName: payload.data.file_name,
          contentType: payload.data.content_type,
          fileSize: payload.data.file_size,
          createdAt: payload.data.created_at,
          downloadUrl: null,
          youtubeUrl: payload.data.youtube_url ?? youtubeUrl,
        },
        ...prev,
      ]);

      setFolders((prev) =>
        prev.map((folder) =>
          folder.id === folderId
            ? {
                ...folder,
                filesCount: folder.filesCount + 1,
              }
            : folder,
        ),
      );

      setYoutubeUrlInput("");
      setYoutubeTitleInput("");
      toast.success("Enlace de YouTube guardado correctamente.");
      setCreatingYoutubeFolderId(null);
    } catch {
      toast.error("No se pudo guardar el enlace de YouTube");
      setCreatingYoutubeFolderId(null);
    }
  }

  async function removeFile(fileId: number, folderId: number) {
    setDeletingFileId(fileId);

    try {
      const response = await fetch(`/api/course-materials/files/${fileId}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !payload?.success) {
        toast.error(payload?.error ?? "No se pudo eliminar el archivo");
        setDeletingFileId(null);
        return;
      }

      setFiles((prev) => prev.filter((file) => file.id !== fileId));
      setFolders((prev) =>
        prev.map((folder) =>
          folder.id === folderId
            ? {
                ...folder,
                filesCount: Math.max(0, folder.filesCount - 1),
              }
            : folder,
        ),
      );

      toast.success("Archivo eliminado correctamente.");
      setDeletingFileId(null);
    } catch {
      toast.error("No se pudo eliminar el archivo");
      setDeletingFileId(null);
    }
  }

  function promptRemoveFolder(folder: FolderExplorerFolder) {
    const branchIds = collectFolderBranchIds(folder.id);
    const branchSet = new Set<number>(branchIds);
    const nestedCount = Math.max(0, branchIds.length - 1);
    const filesInBranch = files.reduce(
      (count, file) => count + (branchSet.has(file.folderId) ? 1 : 0),
      0,
    );

    setPendingFolderDelete({
      folder,
      nestedCount,
      filesInBranch,
    });
  }

  async function removeFolder(folder: FolderExplorerFolder) {
    const branchIds = collectFolderBranchIds(folder.id);
    const branchSet = new Set<number>(branchIds);

    setDeletingFolderId(folder.id);

    try {
      const response = await fetch("/api/course-materials/folders", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_curso: courseId,
          folder_id: folder.id,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !payload?.success) {
        toast.error(payload?.error ?? "No se pudo eliminar la carpeta");
        setDeletingFolderId(null);
        return;
      }

      setFolders((prev) => prev.filter((item) => !branchSet.has(item.id)));
      setFiles((prev) => prev.filter((item) => !branchSet.has(item.folderId)));
      setExpandedFolderIds((prev) => {
        const next = new Set(prev);
        for (const id of branchSet) {
          next.delete(id);
        }
        return next;
      });

      if (branchSet.has(selectedFolderId)) {
        setSelectedFileId(null);
      }

      if (folder.id === initialFolderId) {
        toast.success("Carpeta eliminada correctamente.");
        router.push(`/dashboard/courses/${courseId}/materials/content`);
        router.refresh();
        setDeletingFolderId(null);
        return;
      }

      if (branchSet.has(selectedFolderId)) {
        setSelectedFolderId(folder.parentFolderId ?? initialFolderId);
      }

      toast.success("Carpeta eliminada correctamente.");
      setDeletingFolderId(null);
      setPendingFolderDelete(null);
    } catch {
      toast.error("No se pudo eliminar la carpeta");
      setDeletingFolderId(null);
    }
  }

  function renderTree(
    folder: FolderExplorerFolder,
    depth: number,
  ): JSX.Element {
    const children = childrenByParent.get(folder.id) ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedFolderIds.has(folder.id);
    const isSelected = selectedFolder?.id === folder.id;

    return (
      <div key={folder.id} className="space-y-1">
        <div
          className={`flex items-center gap-1 rounded-md px-2 py-1 ${
            isSelected ? "bg-red-50 text-red-700" : "hover:bg-gray-100"
          }`}
          style={{ marginLeft: depth * 12 }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleFolder(folder.id)}
              className="inline-flex h-5 w-5 items-center justify-center rounded text-gray-600 hover:bg-gray-200"
              aria-label={isExpanded ? "Contraer" : "Expandir"}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="inline-flex h-5 w-5" />
          )}

          <button
            type="button"
            onClick={() => handleSelectFolder(folder.id)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <Folder className="h-4 w-4 shrink-0" />
            <span className="truncate text-sm font-medium">{folder.name}</span>
          </button>
        </div>

        {hasChildren && isExpanded ? (
          <div className="space-y-1">
            {children.map((child) => renderTree(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  }

  function renderPreview() {
    if (!selectedFile) {
      return (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
          Seleccione un material para visualizarlo.
        </div>
      );
    }

    const isYouTube = selectedFile.contentType === "video/youtube";
    const youtubeId = extractYouTubeId(selectedFile.youtubeUrl);

    if (isYouTube && youtubeId) {
      return (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Vista previa</h3>
          <div className="aspect-video overflow-hidden rounded-lg border border-gray-200">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}`}
              title={selectedFile.fileName}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
          {selectedFile.youtubeUrl ? (
            <a
              href={selectedFile.youtubeUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir en YouTube
            </a>
          ) : null}
        </div>
      );
    }

    const isImage = selectedFile.contentType?.startsWith("image/") ?? false;
    const isVideo = selectedFile.contentType?.startsWith("video/") ?? false;
    const isPdf = selectedFile.contentType?.includes("pdf") ?? false;

    if (isImage && selectedFile.downloadUrl) {
      return (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Vista previa</h3>
          <img
            src={selectedFile.downloadUrl}
            alt={selectedFile.fileName}
            className="max-h-[460px] w-full rounded-lg border border-gray-200 object-contain"
          />
        </div>
      );
    }

    if (isVideo && selectedFile.downloadUrl) {
      return (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Vista previa</h3>
          <video
            src={selectedFile.downloadUrl}
            controls
            className="max-h-[460px] w-full rounded-lg border border-gray-200"
          />
        </div>
      );
    }

    if (isPdf && selectedFile.downloadUrl) {
      return (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Vista previa</h3>
          <iframe
            src={selectedFile.downloadUrl}
            title={selectedFile.fileName}
            className="h-[520px] w-full rounded-lg border border-gray-200"
          />
        </div>
      );
    }

    return (
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">Vista previa</h3>
        <p className="text-sm text-gray-600">
          Este tipo de archivo no tiene vista previa embebida.
        </p>
        {selectedFile.downloadUrl ? (
          <a
            href={selectedFile.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir archivo
          </a>
        ) : null}
      </div>
    );
  }

  if (!rootFolder) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        La carpeta seleccionada no existe.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-gray-500">Carpeta</p>
        <h2 className="mt-1 text-lg font-semibold text-gray-900">
          {rootFolder.name}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Explore subcarpetas y seleccione contenido para visualizar.
        </p>

        <div className="mt-4 space-y-1">{renderTree(rootFolder, 0)}</div>
      </aside>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Contenido activo
          </p>
          {selectedFolder && editingFolderId === selectedFolder.id ? (
            <div className="mt-1 flex items-center gap-2">
              <Input
                value={editingFolderName}
                onChange={(event) => setEditingFolderName(event.target.value)}
                className="h-9 max-w-xl text-xl font-semibold text-gray-900"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitFolderRename(selectedFolder);
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelFolderRename();
                  }
                }}
                onBlur={() => {
                  if (savingFolderId !== selectedFolder.id) {
                    void submitFolderRename(selectedFolder);
                  }
                }}
              />
              {savingFolderId === selectedFolder.id ? (
                <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
              ) : null}
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-900">
                {selectedFolder?.name ?? "Sin carpeta"}
              </h2>
              {canManage && selectedFolder ? (
                <>
                  <button
                    type="button"
                    onClick={() => startFolderRename(selectedFolder)}
                    disabled={
                      savingFolderId === selectedFolder.id ||
                      deletingFolderId === selectedFolder.id
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-60"
                    aria-label={`Editar nombre de ${selectedFolder.name}`}
                  >
                    {savingFolderId === selectedFolder.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Pencil className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => promptRemoveFolder(selectedFolder)}
                    disabled={
                      deletingFolderId === selectedFolder.id ||
                      savingFolderId === selectedFolder.id
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
                    aria-label={`Eliminar carpeta ${selectedFolder.name}`}
                  >
                    {deletingFolderId === selectedFolder.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </>
              ) : null}
            </div>
          )}
          <p className="mt-1 text-sm text-gray-600">
            {selectedFolder?.parentFolderId === null
              ? `${selectedSubfolderCount} subcarpeta(s) en esta carpeta`
              : `${selectedFolderFiles.length} elemento(s) en esta carpeta`}
          </p>
        </div>

        {canManage && selectedFolder ? (
          <div className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 md:grid-cols-2">
            {selectedFolder.parentFolderId === null ? (
              <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 md:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Imagen de carpeta padre
                </p>
                <div className="h-28 overflow-hidden rounded-md border border-gray-200 bg-gradient-to-br from-slate-100 via-slate-50 to-white">
                  {selectedFolder.cardImageUrl ? (
                    <img
                      src={selectedFolder.cardImageUrl}
                      alt={`Imagen de ${selectedFolder.name}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">
                      <ImagePlus className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
                  <button
                    type="button"
                    onClick={() => setFolderCardImageSourceMode("upload")}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                      folderCardImageSourceMode === "upload"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Desde archivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setFolderCardImageSourceMode("url")}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                      folderCardImageSourceMode === "url"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Desde URL
                  </button>
                </div>

                {folderCardImageSourceMode === "upload" ? (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
                    {uploadingCardFolderId === selectedFolder.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    {uploadingCardFolderId === selectedFolder.id
                      ? "Subiendo imagen..."
                      : "Subir imagen"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingCardFolderId === selectedFolder.id}
                      onChange={(event) => {
                        void uploadFolderCard(
                          selectedFolder.id,
                          event.target.files,
                        );
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={cardImageUrlInput}
                      onChange={(event) =>
                        setCardImageUrlInput(event.target.value)
                      }
                      placeholder="https://imagen-ejemplo.com/carpeta.jpg"
                      disabled={savingCardUrlFolderId === selectedFolder.id}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void setFolderCardUrl(selectedFolder.id)}
                      disabled={
                        !cardImageUrlInput.trim() ||
                        savingCardUrlFolderId === selectedFolder.id
                      }
                    >
                      {savingCardUrlFolderId === selectedFolder.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Usar URL
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Crear subcarpeta
              </p>
              <Input
                value={newSubfolderName}
                onChange={(event) => setNewSubfolderName(event.target.value)}
                placeholder="Ejemplo: Taller 1"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void createSubfolder()}
                disabled={!newSubfolderName.trim() || isCreatingSubfolder}
              >
                {isCreatingSubfolder ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FolderPlus className="mr-2 h-4 w-4" />
                )}
                {isCreatingSubfolder ? "Creando..." : "Crear subcarpeta"}
              </Button>
            </div>

            <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Subir archivos
              </p>
              <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                {uploadingFolderId === selectedFolder.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploadingFolderId === selectedFolder.id
                  ? "Subiendo..."
                  : "Seleccionar archivos"}
                <input
                  type="file"
                  multiple
                  className="hidden"
                  disabled={uploadingFolderId === selectedFolder.id}
                  onChange={(event) => {
                    void uploadFiles(selectedFolder.id, event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 md:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Agregar video de YouTube
              </p>
              <Input
                value={youtubeUrlInput}
                onChange={(event) => setYoutubeUrlInput(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <Input
                value={youtubeTitleInput}
                onChange={(event) => setYoutubeTitleInput(event.target.value)}
                placeholder="Título opcional"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void createYouTubeLink(selectedFolder.id)}
                disabled={creatingYoutubeFolderId === selectedFolder.id}
              >
                {creatingYoutubeFolderId === selectedFolder.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="mr-2 h-4 w-4" />
                )}
                {creatingYoutubeFolderId === selectedFolder.id
                  ? "Guardando..."
                  : "Guardar enlace"}
              </Button>
            </div>
          </div>
        ) : null}

        {selectedFolderFiles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
            Esta carpeta no tiene archivos todavía.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {selectedFolderFiles.map((file) => {
              const youtubeId = extractYouTubeId(file.youtubeUrl);
              const youtubeThumb = youtubeId
                ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
                : null;
              const isSelected = file.id === resolvedSelectedFileId;
              const isYouTube = file.contentType === "video/youtube";

              return (
                <div
                  key={file.id}
                  className={`overflow-hidden rounded-xl border text-left transition ${
                    isSelected
                      ? "border-red-200 bg-red-50"
                      : "border-gray-200 bg-white hover:border-red-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedFileId(file.id)}
                    className="w-full text-left"
                  >
                    {isYouTube && youtubeThumb ? (
                      <img
                        src={youtubeThumb}
                        alt={file.fileName}
                        className="h-28 w-full object-cover"
                      />
                    ) : null}

                    <div className="p-3">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {file.fileName}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {isYouTube
                          ? "Video de YouTube"
                          : formatBytes(file.fileSize)}{" "}
                        · {new Date(file.createdAt).toLocaleDateString("es-CO")}
                      </p>
                      <div className="mt-2 inline-flex items-center gap-1 text-xs text-red-700">
                        {isYouTube ? (
                          <PlayCircle className="h-3.5 w-3.5" />
                        ) : file.contentType?.startsWith("image/") ? (
                          <ImageIcon className="h-3.5 w-3.5" />
                        ) : (
                          <FileText className="h-3.5 w-3.5" />
                        )}
                        {isYouTube
                          ? "YouTube"
                          : (file.contentType ?? "Archivo")}
                      </div>
                    </div>
                  </button>

                  {canManage && selectedFolder ? (
                    <div className="flex justify-end border-t border-gray-200 px-3 py-2">
                      <button
                        type="button"
                        onClick={() =>
                          void removeFile(file.id, selectedFolder.id)
                        }
                        disabled={deletingFileId === file.id}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        {deletingFileId === file.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Eliminar
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {renderPreview()}

        <AlertDialog
          open={!!pendingFolderDelete}
          onOpenChange={(open) => {
            if (!open && !deletingFolderId) {
              setPendingFolderDelete(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-bold text-[#b92f2d]">
                ¿Eliminar carpeta?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingFolderDelete
                  ? `Se eliminará la carpeta "${pendingFolderDelete.folder.name}" con ${pendingFolderDelete.nestedCount} subcarpeta(s) y ${pendingFolderDelete.filesInBranch} archivo(s). Esta acción no se puede deshacer.`
                  : "Esta acción no se puede deshacer."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={!!deletingFolderId}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingFolderDelete) {
                    void removeFolder(pendingFolderDelete.folder);
                  }
                }}
                disabled={!!deletingFolderId || !pendingFolderDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                {deletingFolderId ? "Eliminando..." : "Eliminar carpeta"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
