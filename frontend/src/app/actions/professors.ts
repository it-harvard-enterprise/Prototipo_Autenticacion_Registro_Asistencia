"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureApprovedAdmin } from "@/lib/auth/approved-admin";
import { inviteUserByEmail } from "@/lib/supabase/admin";

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

  const { error } = await supabase.from("profesores").insert({
    tipo_identificacion: data.tipo_identificacion,
    numero_identificacion: data.numero_identificacion,
    nombres: data.nombres,
    apellidos: data.apellidos,
    telefono: data.telefono,
    direccion: data.direccion,
    barrio: data.barrio,
    nombre_contacto_emergencia: data.nombre_contacto_emergencia,
    telefono_contacto_emergencia: data.telefono_contacto_emergencia,
    eps: data.eps,
    email: data.email,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const frontendOrigin =
    process.env.FRONTEND_ORIGIN?.split(",")[0]?.trim() ||
    "http://localhost:3000";
  const emailRedirectTo = new URL("/login", frontendOrigin).toString();
  const inviteResult = await inviteUserByEmail(data.email, emailRedirectTo);

  if (!inviteResult.ok && !inviteResult.alreadyRegistered) {
    return {
      success: false,
      error: inviteResult.error || "No se pudo enviar la invitación",
    };
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
        tipo_identificacion: data.tipo_identificacion,
      }),
      ...(data.numero_identificacion !== undefined && {
        numero_identificacion: data.numero_identificacion,
      }),
      ...(data.nombres !== undefined && { nombres: data.nombres }),
      ...(data.apellidos !== undefined && { apellidos: data.apellidos }),
      ...(data.telefono !== undefined && { telefono: data.telefono }),
      ...(data.direccion !== undefined && { direccion: data.direccion }),
      ...(data.barrio !== undefined && { barrio: data.barrio }),
      ...(data.nombre_contacto_emergencia !== undefined && {
        nombre_contacto_emergencia: data.nombre_contacto_emergencia,
      }),
      ...(data.telefono_contacto_emergencia !== undefined && {
        telefono_contacto_emergencia: data.telefono_contacto_emergencia,
      }),
      ...(data.eps !== undefined && { eps: data.eps }),
      ...(data.email !== undefined && { email: data.email }),
      updated_at: new Date().toISOString(),
    })
    .eq("numero_identificacion", numeroIdentificacion);

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
