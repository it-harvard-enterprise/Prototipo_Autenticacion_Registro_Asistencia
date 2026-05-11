import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureApprovedAdmin } from "@/lib/auth/approved-admin";
import { resolveBiometricBackendBaseUrl } from "@/lib/biometric-backend";
import {
  createManagedAuthUser,
  deleteAuthUserById,
} from "@/lib/supabase/admin";

function upper(value: string): string {
  return value.trim().toUpperCase();
}

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
    const numeroIdentificacion = upper(
      String(payload?.numero_identificacion ?? ""),
    );
    const tipoIdentificacion = upper(
      String(payload?.tipo_identificacion ?? "CC"),
    );
    const email = String(payload?.email ?? "")
      .trim()
      .toLowerCase();

    if (!numeroIdentificacion) {
      return NextResponse.json(
        {
          success: false,
          error: "El número de identificación es obligatorio.",
        },
        { status: 400 },
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: "El correo electrónico del estudiante es obligatorio.",
        },
        { status: 400 },
      );
    }

    const createdAuthUser = await createManagedAuthUser({
      email,
      password: numeroIdentificacion,
      role: "estudiante",
      nombres: upper(String(payload?.nombres ?? "")),
      apellidos: upper(String(payload?.apellidos ?? "")),
      tipoIdentificacion,
      numeroIdentificacion,
      approvedByAdmin: true,
    });

    if (!createdAuthUser.ok) {
      return NextResponse.json(
        {
          success: false,
          error: createdAuthUser.alreadyRegistered
            ? "El correo ya está registrado en autenticación."
            : createdAuthUser.error,
        },
        { status: 400 },
      );
    }

    const payloadForEnrollment = {
      ...payload,
      numero_identificacion: numeroIdentificacion,
      tipo_identificacion: tipoIdentificacion,
      email,
    };

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
      body: JSON.stringify(payloadForEnrollment),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);

      const rollback = await deleteAuthUserById(createdAuthUser.userId);
      return NextResponse.json(
        {
          success: false,
          error:
            body?.error ||
            `Backend error ${res.status}${rollback.ok ? "" : " (y falló rollback auth)"}`,
        },
        { status: 502 },
      );
    }

    const supabase = await createClient();
    const { data: linkedStudent, error: linkError } = await supabase
      .from("estudiantes")
      .update({ auth_user_id: createdAuthUser.userId })
      .eq("numero_identificacion", numeroIdentificacion)
      .select("numero_identificacion")
      .maybeSingle();

    if (linkError || !linkedStudent) {
      await deleteAuthUserById(createdAuthUser.userId);
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo vincular el usuario auth con el estudiante recién creado.",
        },
        { status: 500 },
      );
    }

    const body = await res.json().catch(() => null);

    return NextResponse.json(
      {
        ...body,
        success: true,
        auth_user_id: createdAuthUser.userId,
        requires_password_change: true,
      },
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
