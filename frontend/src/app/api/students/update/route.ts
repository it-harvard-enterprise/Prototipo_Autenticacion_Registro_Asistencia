import { NextResponse } from "next/server";
import { updateStudent as serverUpdate } from "@/app/actions/students";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { numero_identificacion, data } = payload;
    if (!numero_identificacion) {
      return NextResponse.json(
        { success: false, error: "numero_identificacion es requerido" },
        { status: 400 },
      );
    }

    const result = await serverUpdate(numero_identificacion, data || {});
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 200 },
    );
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
