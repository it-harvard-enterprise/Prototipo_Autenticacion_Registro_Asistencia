import { type NextRequest, NextResponse } from "next/server";
import {
  biometricBackendConfigHint,
  resolveBiometricBackendBaseUrl,
} from "@/lib/biometric-backend";

const noStoreHeaders: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function withCors(headers: Headers): Headers {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return headers;
}

function backendHealthUrl(): string | null {
  const backendUrl = resolveBiometricBackendBaseUrl();
  if (!backendUrl) {
    return null;
  }

  return `${backendUrl}/health`;
}

async function resolveBackendStatus(): Promise<{
  status: string;
  detail: string;
}> {
  const healthUrl = backendHealthUrl();
  if (!healthUrl) {
    return {
      status: "unknown",
      detail: biometricBackendConfigHint(),
    };
  }

  try {
    const response = await fetch(healthUrl, {
      method: "HEAD",
      cache: "no-store",
      next: { revalidate: 0 },
    });

    return {
      status: response.ok ? "ok" : "down",
      detail: `status:${response.status}`,
    };
  } catch {
    return { status: "down", detail: "unreachable" };
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  const headers = withCors(new Headers(noStoreHeaders));
  return new NextResponse(null, { status: 204, headers });
}

export async function HEAD(request: NextRequest): Promise<NextResponse> {
  const scope = request.nextUrl.searchParams.get("scope");
  const backend =
    scope === "frontend"
      ? { status: "not_checked", detail: "scope=frontend" }
      : await resolveBackendStatus();
  const overall =
    backend.status === "ok" || backend.status === "not_checked"
      ? "ok"
      : "degraded";

  const headers = withCors(new Headers(noStoreHeaders));
  headers.set("X-Health-Frontend", "ok");
  headers.set("X-Health-Backend", backend.status);
  headers.set("X-Health-Backend-Detail", backend.detail);
  headers.set("X-Health-Overall", overall);

  return new NextResponse(null, {
    status: overall === "ok" ? 200 : 503,
    headers,
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const scope = request.nextUrl.searchParams.get("scope");
  const backend =
    scope === "frontend"
      ? { status: "not_checked", detail: "scope=frontend" }
      : await resolveBackendStatus();
  const overall =
    backend.status === "ok" || backend.status === "not_checked"
      ? "ok"
      : "degraded";

  const headers = withCors(new Headers(noStoreHeaders));
  return NextResponse.json(
    {
      frontend: "ok",
      backend: backend.status,
      backend_detail: backend.detail,
      overall,
    },
    {
      status: overall === "ok" ? 200 : 503,
      headers,
    },
  );
}
