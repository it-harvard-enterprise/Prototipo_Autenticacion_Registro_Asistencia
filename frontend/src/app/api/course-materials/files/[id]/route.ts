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
  error?: string;
  userId?: string;
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

async function ensureCanReadMaterials(): Promise<{
  ok: boolean;
  error?: string;
  userId?: string;
}> {
  const access = await resolveCurrentUserAccess();

  if (!access.user) {
    return { ok: false, error: "Debe iniciar sesión." };
  }

  if (!access.approved) {
    return { ok: false, error: "Su usuario no está aprobado." };
  }

  const canRead =
    access.role === "administrador" ||
    access.role === "profesor" ||
    access.role === "estudiante";

  if (!canRead) {
    return {
      ok: false,
      error: "No tiene permisos para consultar materiales.",
    };
  }

  return { ok: true, userId: access.user.id };
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const permissions = await ensureCanReadMaterials();
    if (!permissions.ok) {
      return NextResponse.json(
        { success: false, error: permissions.error },
        { status: 403 },
      );
    }

    const { id } = await params;
    const fileId = Number(id);

    if (!Number.isInteger(fileId) || fileId <= 0) {
      return NextResponse.json(
        { success: false, error: "ID de archivo inválido." },
        { status: 400 },
      );
    }

    const query = new URLSearchParams({
      user_id: permissions.userId ?? "",
    });
    const response = await callBackendRaw(
      `/api/course-materials/files/${fileId}/download?${query.toString()}`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      return NextResponse.json(
        {
          success: false,
          error: payload?.error ?? "No se pudo abrir el archivo.",
        },
        { status: response.status || 500 },
      );
    }

    const fileBuffer = await response.arrayBuffer();
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    const contentDisposition =
      response.headers.get("content-disposition") || "inline";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: toApiError(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const permissions = await ensureCanManageMaterials();
    if (!permissions.ok) {
      return NextResponse.json(
        { success: false, error: permissions.error },
        { status: 403 },
      );
    }

    const { id } = await params;
    const fileId = Number(id);

    if (!Number.isInteger(fileId) || fileId <= 0) {
      return NextResponse.json(
        { success: false, error: "ID de archivo inválido." },
        { status: 400 },
      );
    }

    const response = await callBackendRaw(
      "/api/course-materials/files/delete",
      {
        method: "POST",
        body: JSON.stringify({
          id: fileId,
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
          error: payload?.error ?? "No se pudo eliminar el archivo.",
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
