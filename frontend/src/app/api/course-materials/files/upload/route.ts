import { NextResponse } from "next/server";

import { resolveCurrentUserAccess } from "@/lib/auth/resolved-access";
import { callBackendRaw } from "@/lib/backend/server-api";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

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

    const form = await req.formData();
    const idCurso = Number(form.get("id_curso"));
    const folderId = Number(form.get("folder_id"));
    const files = form
      .getAll("files")
      .filter((item) => item instanceof File) as File[];

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

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: "Debe seleccionar al menos un archivo." },
        { status: 400 },
      );
    }

    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          {
            success: false,
            error: `El archivo ${file.name} supera el límite de 25 MB.`,
          },
          { status: 400 },
        );
      }
    }

    const backendForm = new FormData();
    backendForm.set("id_curso", String(idCurso));
    backendForm.set("folder_id", String(folderId));
    backendForm.set("user_id", permissions.userId ?? "");
    for (const file of files) {
      backendForm.append("files", file);
    }

    const response = await callBackendRaw(
      "/api/course-materials/files/upload",
      {
        method: "POST",
        body: backendForm,
      },
    );

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
      }>;
    } | null;

    if (!response.ok || !payload?.success || !payload.data) {
      return NextResponse.json(
        {
          success: false,
          error: payload?.error ?? "No se pudieron subir los archivos.",
        },
        { status: response.status || 500 },
      );
    }

    const normalized = payload.data.map((row) => ({
      ...row,
      download_url: `/api/course-materials/files/${row.id}`,
    }));

    return NextResponse.json({ success: true, data: normalized });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: toApiError(error) },
      { status: 500 },
    );
  }
}
