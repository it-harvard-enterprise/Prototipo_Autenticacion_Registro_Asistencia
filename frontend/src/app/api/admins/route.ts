import { NextResponse } from "next/server";

import { getAdmins } from "@/app/actions/admins";

export async function GET() {
  try {
    const result = await getAdmins();

    if (!result.success) {
      const status =
        result.error === "No tiene permisos de administrador." ||
        result.error ===
          "Su usuario administrador no está aprobado para acceder a esta funcionalidad." ||
        result.error === "Debe iniciar sesión para continuar."
          ? 403
          : 400;

      return NextResponse.json(
        {
          success: false,
          error: result.error ?? "No fue posible consultar administradores",
        },
        { status },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.data ?? [],
      },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}
