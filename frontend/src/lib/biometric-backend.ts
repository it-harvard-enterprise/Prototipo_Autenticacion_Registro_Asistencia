function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/$/, "");
}

export function resolveBiometricBackendBaseUrl(): string | null {
  const internalUrl = normalizeBaseUrl(
    process.env.BIOMETRIC_BACKEND_INTERNAL_URL,
  );
  if (internalUrl) {
    return internalUrl;
  }

  return normalizeBaseUrl(process.env.BIOMETRIC_BACKEND_URL);
}

export function biometricBackendConfigHint(): string {
  return "Configure BIOMETRIC_BACKEND_INTERNAL_URL (Docker local, e.g. http://proto-backend:4000) or BIOMETRIC_BACKEND_URL (public URL, e.g. https://your-backend.onrender.com).";
}
