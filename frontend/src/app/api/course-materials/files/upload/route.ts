import { NextResponse } from "next/server";

import { resolveCurrentUserAccess } from "@/lib/auth/resolved-access";
import { callBackendRaw } from "@/lib/backend/server-api";

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

    const contentType = req.headers.get("content-type")?.trim() ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "La solicitud de carga debe enviarse como multipart/form-data.",
        },
        { status: 400 },
      );
    }

    if (!req.body) {
      return NextResponse.json(
        { success: false, error: "No se encontraron datos para la carga." },
        { status: 400 },
      );
    }

    const forwardedHeaders = new Headers({
      "Content-Type": contentType,
      "X-Materials-User-Id": permissions.userId ?? "",
    });
    const contentLength = req.headers.get("content-length")?.trim();
    if (contentLength) {
      forwardedHeaders.set("Content-Length", contentLength);
    }

    const response = await callBackendRaw(
      "/api/course-materials/files/upload",
      {
        method: "POST",
        headers: forwardedHeaders,
        body: req.body,
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
