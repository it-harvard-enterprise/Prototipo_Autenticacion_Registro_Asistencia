import { NextResponse } from "next/server";
import { resolveBiometricBackendBaseUrl } from "@/lib/biometric-backend";

export async function GET() {
  const backendUrl = resolveBiometricBackendBaseUrl();
  if (!backendUrl) {
    return NextResponse.json(
      { message: "La URL del backend no está configurada." },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(`${backendUrl}/startService`);
    const contentType = res.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await res.json()
      : { message: await res.text() };
    return NextResponse.json(body, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { message: "No se pudo iniciar el servicio de captura de huellas" },
      { status: 500 },
    );
  }
}
