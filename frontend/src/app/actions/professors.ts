"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureApprovedAdmin } from "@/lib/auth/approved-admin";
import {
  createManagedAuthUser,
  deleteAuthUserById,
} from "@/lib/supabase/admin";

function upper(value: string): string {
  return value.trim().toUpperCase();
}

export interface ProfessorFormData {
  tipo_identificacion: string;
  numero_identificacion: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  direccion: string;
  barrio: string;
  nombre_contacto_emergencia: string;
  telefono_contacto_emergencia: string;
  eps: string;
  email: string;
}

export async function createProfessor(
  data: ProfessorFormData,
): Promise<{ success: boolean; error?: string }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const supabase = await createClient();

  const numeroIdentificacion = upper(data.numero_identificacion);
  const createdAuthUser = await createManagedAuthUser({
    email: data.email,
    password: numeroIdentificacion,
    role: "profesor",
    nombres: upper(data.nombres),
    apellidos: upper(data.apellidos),
    tipoIdentificacion: upper(data.tipo_identificacion),
    numeroIdentificacion,
    approvedByAdmin: true,
  });

  if (!createdAuthUser.ok) {
    return {
      success: false,
      error: createdAuthUser.alreadyRegistered
        ? "El correo ya está registrado en autenticación."
        : createdAuthUser.error,
    };
  }

  const { error } = await supabase.from("profesores").insert({
    tipo_identificacion: upper(data.tipo_identificacion),
    numero_identificacion: numeroIdentificacion,
    nombres: upper(data.nombres),
    apellidos: upper(data.apellidos),
    telefono: upper(data.telefono),
    direccion: upper(data.direccion),
    barrio: upper(data.barrio),
    nombre_contacto_emergencia: upper(data.nombre_contacto_emergencia),
    telefono_contacto_emergencia: upper(data.telefono_contacto_emergencia),
    eps: upper(data.eps),
    email: data.email.trim().toLowerCase(),
    auth_user_id: createdAuthUser.userId,
  });

  if (error) {
    await deleteAuthUserById(createdAuthUser.userId);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function updateProfessor(
  numeroIdentificacion: string,
  data: Partial<ProfessorFormData>,
): Promise<{ success: boolean; error?: string }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("profesores")
    .update({
      ...(data.tipo_identificacion !== undefined && {
        tipo_identificacion: upper(data.tipo_identificacion),
      }),
      ...(data.numero_identificacion !== undefined && {
        numero_identificacion: upper(data.numero_identificacion),
      }),
      ...(data.nombres !== undefined && { nombres: upper(data.nombres) }),
      ...(data.apellidos !== undefined && { apellidos: upper(data.apellidos) }),
      ...(data.telefono !== undefined && { telefono: upper(data.telefono) }),
      ...(data.direccion !== undefined && { direccion: upper(data.direccion) }),
      ...(data.barrio !== undefined && { barrio: upper(data.barrio) }),
      ...(data.nombre_contacto_emergencia !== undefined && {
        nombre_contacto_emergencia: upper(data.nombre_contacto_emergencia),
      }),
      ...(data.telefono_contacto_emergencia !== undefined && {
        telefono_contacto_emergencia: upper(data.telefono_contacto_emergencia),
      }),
      ...(data.eps !== undefined && { eps: upper(data.eps) }),
      ...(data.email !== undefined && { email: data.email.trim() }),
      updated_at: new Date().toISOString(),
    })
    .eq("numero_identificacion", upper(numeroIdentificacion));

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteProfessor(
  numeroIdentificacion: string,
): Promise<{ success: boolean; error?: string }> {
  const approval = await ensureApprovedAdmin();
  if (!approval.ok) {
    return { success: false, error: approval.error };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("profesores")
    .delete()
    .eq("numero_identificacion", numeroIdentificacion);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
