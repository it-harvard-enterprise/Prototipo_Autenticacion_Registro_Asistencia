"use server";

import { callBackend } from "@/lib/backend/server-api";
import { resolveCurrentUserAccess } from "@/lib/auth/resolved-access";
import { toAppErrorMessage } from "@/lib/error-messages";

export interface CourseMaterialFolder {
  id: number;
  idCurso: number;
  parentFolderId: number | null;
  name: string;
  createdAt: string;
  updatedAt: string;
  filesCount: number;
  cardImageUrl: string | null;
}

export interface CourseMaterialFile {
  id: number;
  idCurso: number;
  folderId: number;
  fileName: string;
  contentType: string | null;
  fileSize: number;
  createdAt: string;
  downloadUrl: string | null;
  youtubeUrl: string | null;
}

export interface CourseMaterialsSnapshot {
  coverImageUrl: string | null;
  folders: CourseMaterialFolder[];
  files: CourseMaterialFile[];
}

export interface CourseMaterialsMember {
  id: string;
  role: "profesor" | "estudiante";
  nombres: string;
  apellidos: string;
  telefono: string;
  email: string;
}

type BackendFolderRow = {
  id: number;
  id_curso: number;
  parent_folder_id: number | null;
  name: string;
  created_at: string;
  updated_at: string;
  files_count: number;
  card_updated_at: string | null;
};

type BackendFileRow = {
  id: number;
  id_curso: number;
  folder_id: number;
  file_name: string;
  content_type: string | null;
  file_size: number;
  created_at: string;
  youtube_url: string | null;
};

type BackendSnapshotData = {
  cover_updated_at: string | null;
  folders: BackendFolderRow[];
  files: BackendFileRow[];
};

type BackendSnapshotResponse = {
  success: boolean;
  data?: BackendSnapshotData;
  error?: string;
};

type BackendMemberRow = {
  numero_identificacion: string;
  role: "PROFESOR" | "ESTUDIANTE" | string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  email: string | null;
};

type BackendMembersResponse = {
  success: boolean;
  data?: BackendMemberRow[];
  error?: string;
};

function toErrorMessage(error: unknown): string {
  return toAppErrorMessage(error, "Error desconocido");
}

async function ensureCourseMaterialsAccess(requireManage: boolean): Promise<{
  ok: boolean;
  error?: string;
  userId?: string;
}> {
  const access = await resolveCurrentUserAccess();

  if (!access.user) {
    return { ok: false, error: "Debe iniciar sesión para continuar." };
  }

  if (!access.approved) {
    return {
      ok: false,
      error: "Su usuario no está aprobado para esta funcionalidad.",
    };
  }

  const canManage =
    access.role === "administrador" || access.role === "profesor";

  if (requireManage && !canManage) {
    return {
      ok: false,
      error: "No tiene permisos para gestionar materiales del curso.",
    };
  }

  if (!canManage && access.role !== "estudiante") {
    return {
      ok: false,
      error: "Rol no autorizado para consultar materiales del curso.",
    };
  }

  return {
    ok: true,
    userId: access.user.id,
  };
}

function resolveCoverImageUrl(
  idCurso: number,
  coverUpdatedAt: string | null,
): string | null {
  if (!coverUpdatedAt) {
    return null;
  }

  const params = new URLSearchParams({
    id_curso: String(idCurso),
    v: coverUpdatedAt,
  });

  return `/api/course-materials/cover?${params.toString()}`;
}

function resolveFolderCardImageUrl(
  folderId: number,
  cardUpdatedAt: string | null,
): string | null {
  if (!cardUpdatedAt) {
    return null;
  }

  const params = new URLSearchParams({
    v: cardUpdatedAt,
  });

  return `/api/course-materials/folders/${folderId}/card?${params.toString()}`;
}

export async function getCourseMaterialsSnapshot(idCurso: number): Promise<{
  success: boolean;
  error?: string;
  data?: CourseMaterialsSnapshot;
}> {
  const access = await ensureCourseMaterialsAccess(false);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  try {
    const query = new URLSearchParams({
      id_curso: String(idCurso),
      user_id: access.userId ?? "",
    });

    const payload = await callBackend<BackendSnapshotResponse>(
      `/api/course-materials/snapshot?${query.toString()}`,
      {
        method: "GET",
      },
    );

    if (!payload.success || !payload.data) {
      return {
        success: false,
        error: payload.error ?? "No fue posible cargar los materiales.",
      };
    }

    const folders: CourseMaterialFolder[] = payload.data.folders.map((row) => ({
      id: row.id,
      idCurso: row.id_curso,
      parentFolderId: row.parent_folder_id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      filesCount: row.files_count,
      cardImageUrl: resolveFolderCardImageUrl(row.id, row.card_updated_at),
    }));

    const files: CourseMaterialFile[] = payload.data.files.map((row) => {
      const isYouTube = row.content_type === "video/youtube";

      return {
        id: row.id,
        idCurso: row.id_curso,
        folderId: row.folder_id,
        fileName: row.file_name,
        contentType: row.content_type,
        fileSize: row.file_size,
        createdAt: row.created_at,
        downloadUrl: isYouTube ? null : `/api/course-materials/files/${row.id}`,
        youtubeUrl: isYouTube ? row.youtube_url : null,
      };
    });

    return {
      success: true,
      data: {
        coverImageUrl: resolveCoverImageUrl(
          idCurso,
          payload.data.cover_updated_at,
        ),
        folders,
        files,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

export async function getCourseMaterialsMembers(idCurso: number): Promise<{
  success: boolean;
  error?: string;
  data?: CourseMaterialsMember[];
}> {
  const access = await ensureCourseMaterialsAccess(false);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  try {
    const payload = await callBackend<BackendMembersResponse>(
      `/api/courses/${idCurso}/participants`,
      {
        method: "GET",
      },
    );

    if (!payload.success || !payload.data) {
      return {
        success: false,
        error: payload.error ?? "No fue posible cargar alumnos del curso.",
      };
    }

    const members: CourseMaterialsMember[] = payload.data
      .filter((row) => row.role === "PROFESOR" || row.role === "ESTUDIANTE")
      .map((row) => ({
        id: row.numero_identificacion,
        role: (row.role === "PROFESOR" ? "profesor" : "estudiante") as
          | "profesor"
          | "estudiante",
        nombres: row.nombres,
        apellidos: row.apellidos,
        telefono: row.telefono?.trim() || "-",
        email: row.email?.trim() || "-",
      }));

    return {
      success: true,
      data: members,
    };
  } catch (error) {
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}
