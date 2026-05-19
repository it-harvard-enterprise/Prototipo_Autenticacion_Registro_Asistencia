import { NextResponse } from "next/server";

import { resolveCurrentUserAccess } from "@/lib/auth/resolved-access";
import { callBackend } from "@/lib/backend/server-api";

function toApiError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Error desconocido";
}

async function ensureCanManageMaterials(): Promise<{
  ok: boolean;
  userId?: string;
  error?: string;
}> {
  const access = await resolveCurrentUserAccess();

  if (!access.user) {
    return { ok: false, error: "Debe iniciar sesión." };
  }

  if (!access.approved) {
    return { ok: false, error: "Su usuario no está aprobado." };
  }

  const canManage =
    access.role === "administrador" || access.role === "profesor";

  if (!canManage) {
    return {
      ok: false,
      error: "No tiene permisos para gestionar materiales.",
    };
  }

  return { ok: true, userId: access.user.id };
}

export async function POST(req: Request) {
  try {
    const permissions = await ensureCanManageMaterials();
    if (!permissions.ok) {
      return NextResponse.json(
        { success: false, error: permissions.error },
        { status: 403 },
      );
    }

    const body = (await req.json()) as {
      id_curso?: unknown;
      folder_id?: unknown;
      url?: unknown;
      title?: unknown;
    };

    const idCurso = Number(body.id_curso);
    const folderId = Number(body.folder_id);
    const link = String(body.url ?? "").trim();
    const title = String(body.title ?? "").trim();

    if (!Number.isInteger(idCurso) || idCurso <= 0) {
      return NextResponse.json(
        { success: false, error: "id_curso inválido." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(folderId) || folderId <= 0) {
      return NextResponse.json(
        { success: false, error: "folder_id inválido." },
        { status: 400 },
      );
    }

    if (!link) {
      return NextResponse.json(
        { success: false, error: "Debe ingresar un enlace de YouTube." },
        { status: 400 },
      );
    }

    const payload = await callBackend<{
      success: boolean;
      error?: string;
      data?: {
        id: number;
        folder_id: number;
        file_name: string;
        content_type: string | null;
        file_size: number;
        created_at: string;
        youtube_url: string | null;
      };
    }>("/api/course-materials/files/youtube/create", {
      method: "POST",
      body: JSON.stringify({
        id_curso: idCurso,
        folder_id: folderId,
        url: link,
        title,
        user_id: permissions.userId,
      }),
    });

    if (!payload.success || !payload.data) {
      return NextResponse.json(
        {
          success: false,
          error: payload.error ?? "No se pudo guardar el enlace de YouTube.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, data: payload.data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: toApiError(error) },
      { status: 500 },
    );
  }
}
