import { NextResponse } from "next/server";
import { resolveBiometricBackendBaseUrl } from "@/lib/biometric-backend";

export async function GET() {
  const backendUrl = resolveBiometricBackendBaseUrl();
  if (!backendUrl) {
    return NextResponse.json(
      { message: "Backend URL not configured." },
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
      { message: "Fingerprint capture service could not be started" },
      { status: 500 },
    );
  }
}
