import { NextResponse } from "next/server";
import { updateProfessor } from "@/app/actions/professors";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const numero_identificacion =
      payload?.numero_identificacion ??
      payload?.id ??
      payload?.data?.numero_identificacion;
    const data = payload?.data ?? {};
    const normalizedNumeroIdentificacion =
      typeof numero_identificacion === "string"
        ? numero_identificacion.trim()
        : "";

    if (!normalizedNumeroIdentificacion) {
      return NextResponse.json(
        { success: false, error: "numero_identificacion es requerido" },
        { status: 400 },
      );
    }

    const result = await updateProfessor(normalizedNumeroIdentificacion, data);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
