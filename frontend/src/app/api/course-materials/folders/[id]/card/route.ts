import { NextResponse } from "next/server";

import { resolveCurrentUserAccess } from "@/lib/auth/resolved-access";
import { callBackendRaw } from "@/lib/backend/server-api";

const MAX_CARD_BYTES = 10 * 1024 * 1024;

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

async function ensureCanReadMaterials(): Promise<{
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
    const folderId = Number(id);

    if (!Number.isInteger(folderId) || folderId <= 0) {
      return NextResponse.json(
        { success: false, error: "ID de carpeta inválido." },
        { status: 400 },
      );
    }

    const query = new URLSearchParams({
      user_id: permissions.userId ?? "",
    });
    const response = await callBackendRaw(
      `/api/course-materials/folders/${folderId}/card/download?${query.toString()}`,
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
          error: payload?.error ?? "No se pudo cargar la imagen de la carpeta.",
        },
        { status: response.status || 500 },
      );
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
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

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const permissions = await ensureCanManageMaterials();
    if (!permissions.ok) {
      return NextResponse.json(
        { success: false, error: permissions.error },
        { status: 403 },
      );
    }

    const { id } = await params;
    const folderId = Number(id);

    if (!Number.isInteger(folderId) || folderId <= 0) {
      return NextResponse.json(
        { success: false, error: "ID de carpeta inválido." },
        { status: 400 },
      );
    }

    const form = await req.formData();
    const idCurso = Number(form.get("id_curso"));
    const image = form.get("image");

    if (!Number.isInteger(idCurso) || idCurso <= 0) {
      return NextResponse.json(
        { success: false, error: "id_curso inválido." },
        { status: 400 },
      );
    }

    if (!(image instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Debe seleccionar una imagen." },
        { status: 400 },
      );
    }

    if (!image.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "El archivo debe ser una imagen." },
        { status: 400 },
      );
    }

    if (image.size > MAX_CARD_BYTES) {
      return NextResponse.json(
        { success: false, error: "La imagen supera el límite de 10 MB." },
        { status: 400 },
      );
    }

    const backendForm = new FormData();
    backendForm.set("id_curso", String(idCurso));
    backendForm.set("folder_id", String(folderId));
    backendForm.set("user_id", permissions.userId ?? "");
    backendForm.set("image", image);

    const response = await callBackendRaw(
      "/api/course-materials/folders/card/upload",
      {
        method: "POST",
        body: backendForm,
      },
    );

    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: string;
      data?: { card_updated_at?: string };
    } | null;

    if (!response.ok || !payload?.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            payload?.error ?? "No se pudo actualizar la imagen de carpeta.",
        },
        { status: response.status || 500 },
      );
    }

    const version = payload.data?.card_updated_at ?? String(Date.now());
    const paramsQuery = new URLSearchParams({ v: version });

    return NextResponse.json({
      success: true,
      data: {
        card_url: `/api/course-materials/folders/${folderId}/card?${paramsQuery.toString()}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: toApiError(error) },
      { status: 500 },
    );
  }
}
