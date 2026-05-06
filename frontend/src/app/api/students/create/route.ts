import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureApprovedAdmin } from "@/lib/auth/approved-admin";
import { resolveBiometricBackendBaseUrl } from "@/lib/biometric-backend";

export async function POST(req: Request) {
  try {
    const approval = await ensureApprovedAdmin();
    if (!approval.ok) {
      return NextResponse.json(
        { success: false, error: approval.error },
        { status: 403 },
      );
    }

    const payload = await req.json();
    const frontendOrigin = req.headers.get("origin") ?? new URL(req.url).origin;

    const backendUrl = resolveBiometricBackendBaseUrl();
    if (!backendUrl) {
      return NextResponse.json(
        { success: false, error: "Backend URL not configured" },
        { status: 500 },
      );
    }

    const res = await fetch(`${backendUrl}/api/students/enroll`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Frontend-Origin": frontendOrigin,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return NextResponse.json(
        { success: false, error: body?.error || `Backend error ${res.status}` },
        { status: 502 },
      );
    }

    const body = await res.json().catch(() => null);

    // Return backend response; frontend may fetch the created student separately
    return NextResponse.json(body, { status: 200 });
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
