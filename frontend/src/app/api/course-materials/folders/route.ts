import { NextResponse } from "next/server";

import { resolveCurrentUserAccess } from "@/lib/auth/resolved-access";
import { callBackend, callBackendRaw } from "@/lib/backend/server-api";

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
      parent_folder_id?: unknown;
      name?: unknown;
    };

    const idCurso = Number(body.id_curso);
    const rawParentFolderId = body.parent_folder_id;
    const parentFolderId =
      rawParentFolderId === null || rawParentFolderId === undefined
        ? null
        : Number(rawParentFolderId);
    const name = String(body.name ?? "").trim();

    if (!Number.isInteger(idCurso) || idCurso <= 0) {
      return NextResponse.json(
        { success: false, error: "id_curso inválido." },
        { status: 400 },
      );
    }

    if (!name) {
      return NextResponse.json(
        { success: false, error: "El nombre de la carpeta es obligatorio." },
        { status: 400 },
      );
    }

    if (
      parentFolderId !== null &&
      (!Number.isInteger(parentFolderId) || parentFolderId <= 0)
    ) {
      return NextResponse.json(
        { success: false, error: "parent_folder_id inválido." },
        { status: 400 },
      );
    }

    const payload = await callBackend<{
      success: boolean;
      error?: string;
      data?: {
        id: number;
        id_curso: number;
        parent_folder_id: number | null;
        name: string;
        created_at: string;
        updated_at: string;
      };
    }>("/api/course-materials/folders/create", {
      method: "POST",
      body: JSON.stringify({
        id_curso: idCurso,
        parent_folder_id: parentFolderId,
        name,
        user_id: permissions.userId,
      }),
    });

    if (!payload.success || !payload.data) {
      return NextResponse.json(
        {
          success: false,
          error: payload.error ?? "No se pudo crear la carpeta.",
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

export async function PATCH(req: Request) {
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
      name?: unknown;
    };

    const idCurso = Number(body.id_curso);
    const folderId = Number(body.folder_id);
    const name = String(body.name ?? "").trim();

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

    if (!name) {
      return NextResponse.json(
        { success: false, error: "El nombre de la carpeta es obligatorio." },
        { status: 400 },
      );
    }

    const payload = await callBackend<{
      success: boolean;
      error?: string;
      data?: {
        id: number;
        id_curso: number;
        parent_folder_id: number | null;
        name: string;
        created_at: string;
        updated_at: string;
      };
    }>("/api/course-materials/folders/update", {
      method: "PATCH",
      body: JSON.stringify({
        id_curso: idCurso,
        folder_id: folderId,
        name,
        user_id: permissions.userId,
      }),
    });

    if (!payload.success || !payload.data) {
      return NextResponse.json(
        {
          success: false,
          error: payload.error ?? "No se pudo actualizar la carpeta.",
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

export async function DELETE(req: Request) {
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
    };

    const idCurso = Number(body.id_curso);
    const folderId = Number(body.folder_id);

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

    const response = await callBackendRaw(
      "/api/course-materials/folders/delete",
      {
        method: "POST",
        body: JSON.stringify({
          id_curso: idCurso,
          folder_id: folderId,
          user_id: permissions.userId,
        }),
      },
    );

    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: string;
    } | null;

    if (!response.ok || !payload?.success) {
      return NextResponse.json(
        {
          success: false,
          error: payload?.error ?? "No se pudo eliminar la carpeta.",
        },
        { status: response.status || 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: toApiError(error) },
      { status: 500 },
    );
  }
}
