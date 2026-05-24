import { NextResponse } from "next/server";
import { updateStudent as serverUpdate } from "@/app/actions/students";
import { resolveBiometricBackendBaseUrl } from "@/lib/biometric-backend";

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const numero_identificacion =
      payload?.numero_identificacion ??
      payload?.id ??
      payload?.data?.numero_identificacion;
    const rawData = (payload?.data ?? {}) as Record<string, unknown>;
    const {
      huella_indice_derecho_encrypted,
      huella_indice_izquierdo_encrypted,
      huella_indice_derecho,
      huella_indice_izquierdo,
      ...dataWithoutFingerprints
    } = rawData;
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

    const hasRightFingerprintUpdate =
      huella_indice_derecho_encrypted != null ||
      hasNonEmptyString(huella_indice_derecho);
    const hasLeftFingerprintUpdate =
      huella_indice_izquierdo_encrypted != null ||
      hasNonEmptyString(huella_indice_izquierdo);

    if (hasRightFingerprintUpdate || hasLeftFingerprintUpdate) {
      const backendUrl = resolveBiometricBackendBaseUrl();
      if (!backendUrl) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Backend URL no configurado. Configure BIOMETRIC_BACKEND_URL o BIOMETRIC_BACKEND_INTERNAL_URL.",
          },
          { status: 500 },
        );
      }

      const frontendOrigin =
        req.headers.get("origin") ?? new URL(req.url).origin;
      const fingerprintPayload: Record<string, unknown> = {
        numero_identificacion: normalizedNumeroIdentificacion,
      };

      if (huella_indice_derecho_encrypted != null) {
        fingerprintPayload.huella_indice_derecho_encrypted =
          huella_indice_derecho_encrypted;
      } else if (hasNonEmptyString(huella_indice_derecho)) {
        fingerprintPayload.huella_indice_derecho = huella_indice_derecho;
      }

      if (huella_indice_izquierdo_encrypted != null) {
        fingerprintPayload.huella_indice_izquierdo_encrypted =
          huella_indice_izquierdo_encrypted;
      } else if (hasNonEmptyString(huella_indice_izquierdo)) {
        fingerprintPayload.huella_indice_izquierdo = huella_indice_izquierdo;
      }

      const fingerprintRes = await fetch(
        `${backendUrl}/api/students/update-fingerprints`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Frontend-Origin": frontendOrigin,
          },
          body: JSON.stringify(fingerprintPayload),
        },
      );

      if (!fingerprintRes.ok) {
        const body = await fingerprintRes.json().catch(() => null);
        const status =
          fingerprintRes.status >= 500 ? 502 : fingerprintRes.status;
        return NextResponse.json(
          {
            success: false,
            error:
              body?.error ||
              `Error actualizando huellas: ${fingerprintRes.status}`,
          },
          { status },
        );
      }
    }

    const result = await serverUpdate(
      normalizedNumeroIdentificacion,
      dataWithoutFingerprints as Parameters<typeof serverUpdate>[1],
    );
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
        error: err instanceof Error ? err.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}
