"use server";

import { ensureApprovedAdmin } from "@/lib/auth/approved-admin";
import { callBackend } from "@/lib/backend/server-api";
import { toAppErrorMessage, translateErrorMessage } from "@/lib/error-messages";
import {
  createAdminClient,
  createManagedAuthUser,
  deleteAuthUserById,
} from "@/lib/supabase/admin";

export interface Admin {
  id: string;
  tipo_identificacion: string;
  numero_identificacion: string;
  nombres: string;
  apellidos: string;
  email: string;
  role: string;
  created_at?: string;
}

export interface AdminFormData {
  tipo_identificacion: string;
  numero_identificacion: string;
  nombres: string;
  apellidos: string;
  email: string;
  password?: string;
}

function upper(value: string): string {
  return value.trim().toUpperCase();
}

function toErrorMessage(error: unknown): string {
  return toAppErrorMessage(error, "Error desconocido");
}

type BackendResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function createAdmin(
  data: AdminFormData,
): Promise<{ success: boolean; error?: string; data?: Admin }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    // 1. Create auth user
    const authResult = await createManagedAuthUser({
      email: data.email.trim().toLowerCase(),
      password: data.password || "TempPassword123",
      role: "administrador",
      nombres: upper(data.nombres),
      apellidos: upper(data.apellidos),
      tipoIdentificacion: upper(data.tipo_identificacion),
      numeroIdentificacion: upper(data.numero_identificacion),
      approvedByAdmin: true,
    });

    if (!authResult.ok) {
      return {
        success: false,
        error:
          authResult.error || "No se pudo crear el usuario de autenticación",
        alreadyRegistered: authResult.alreadyRegistered,
      };
    }

    // 2. Get admin data from database
    const supabase = createAdminClient();
    const { data: admin, error: fetchError } = await supabase
      .from("administrador")
      .select("*")
      .eq("id", authResult.userId)
      .single();

    if (fetchError || !admin) {
      return {
        success: false,
        error: translateErrorMessage(
          fetchError?.message,
          "Se creo el usuario pero no se pudieron recuperar los datos del administrador.",
        ),
      };
    }

    return { success: true, data: admin as Admin };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
}

export async function updateAdmin(
  adminId: string,
  data: Partial<AdminFormData>,
): Promise<{ success: boolean; error?: string; data?: Admin }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const supabase = createAdminClient();
    const updateData: Record<string, unknown> = {};

    if (data.tipo_identificacion !== undefined) {
      updateData.tipo_identificacion = upper(data.tipo_identificacion);
    }
    if (data.numero_identificacion !== undefined) {
      updateData.numero_identificacion = upper(data.numero_identificacion);
    }
    if (data.nombres !== undefined) {
      updateData.nombres = upper(data.nombres);
    }
    if (data.apellidos !== undefined) {
      updateData.apellidos = upper(data.apellidos);
    }
    if (data.email !== undefined) {
      updateData.email = data.email.trim().toLowerCase();
    }

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: "No hay datos para actualizar" };
    }

    const { data: admin, error } = await supabase
      .from("administrador")
      .update(updateData)
      .eq("id", adminId)
      .select()
      .single();

    if (error || !admin) {
      return {
        success: false,
        error: translateErrorMessage(
          error?.message,
          "No se pudo actualizar el administrador.",
        ),
      };
    }

    return { success: true, data: admin as Admin };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
}

export async function deleteAdmin(adminId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    // Delete auth user (which cascades to admin table due to FK)
    const result = await deleteAuthUserById(adminId);
    if (!result.ok) {
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
}

export async function getAdmins(): Promise<{
  success: boolean;
  error?: string;
  data?: Admin[];
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("administrador")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return {
        success: false,
        error: translateErrorMessage(
          error.message,
          "No se pudo consultar administradores.",
        ),
      };
    }

    return { success: true, data: (data ?? []) as Admin[] };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
}

export async function getAdminById(adminId: string): Promise<{
  success: boolean;
  error?: string;
  data?: Admin;
}> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("administrador")
      .select("*")
      .eq("id", adminId)
      .single();

    if (error || !data) {
      return {
        success: false,
        error: translateErrorMessage(
          error?.message,
          "Administrador no encontrado.",
        ),
      };
    }

    return { success: true, data: data as Admin };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
}
