import {
  biometricBackendConfigHint,
  resolveBiometricBackendBaseUrl,
} from "@/lib/biometric-backend";
import { translateErrorMessage } from "@/lib/error-messages";

function resolveFrontendOrigin(): string {
  return (
    process.env.FRONTEND_ORIGIN?.split(",")[0]?.trim() ||
    "http://localhost:3000"
  );
}

export async function callBackend<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const backendUrl = resolveBiometricBackendBaseUrl();
  if (!backendUrl) {
    throw new Error(
      `Backend URL no configurado. ${biometricBackendConfigHint()}`,
    );
  }

  const backendAccessKey = process.env.BIOMETRIC_BACKEND_ACCESS_KEY?.trim();
  const headers = new Headers(init.headers ?? {});
  const isFormDataBody =
    typeof FormData !== "undefined" && init.body instanceof FormData;

  if (!headers.has("Content-Type") && init.body != null && !isFormDataBody) {
    headers.set("Content-Type", "application/json");
  }

  if (!headers.has("X-Frontend-Origin")) {
    headers.set("X-Frontend-Origin", resolveFrontendOrigin());
  }

  if (backendAccessKey && !headers.has("X-Backend-Access-Key")) {
    headers.set("X-Backend-Access-Key", backendAccessKey);
  }

  const response = await fetch(`${backendUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(
      translateErrorMessage(
        payload?.error,
        `Error del backend: ${response.status}`,
      ),
    );
  }

  return payload as T;
}

export async function callBackendRaw(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const backendUrl = resolveBiometricBackendBaseUrl();
  if (!backendUrl) {
    throw new Error(
      `Backend URL no configurado. ${biometricBackendConfigHint()}`,
    );
  }

  const backendAccessKey = process.env.BIOMETRIC_BACKEND_ACCESS_KEY?.trim();
  const headers = new Headers(init.headers ?? {});
  const isFormDataBody =
    typeof FormData !== "undefined" && init.body instanceof FormData;

  if (!headers.has("Content-Type") && init.body != null && !isFormDataBody) {
    headers.set("Content-Type", "application/json");
  }

  if (!headers.has("X-Frontend-Origin")) {
    headers.set("X-Frontend-Origin", resolveFrontendOrigin());
  }

  if (backendAccessKey && !headers.has("X-Backend-Access-Key")) {
    headers.set("X-Backend-Access-Key", backendAccessKey);
  }

  return fetch(`${backendUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
