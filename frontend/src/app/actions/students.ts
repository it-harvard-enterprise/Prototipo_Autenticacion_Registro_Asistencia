'use server'

import { createClient } from '@/lib/supabase/server'
import { Student } from '@/lib/types'

export interface StudentFormData {
  cedula: string
  nombres: string
  apellidos: string
  edad: number
  grado: string
  fingerprint_right?: string | null
  fingerprint_left?: string | null
}

export async function createStudent(
  data: StudentFormData
): Promise<{ success: boolean; error?: string; data?: Student }> {
  const supabase = await createClient()

  const { data: student, error } = await supabase
    .from('students')
    .insert({
      cedula: data.cedula,
      nombres: data.nombres,
      apellidos: data.apellidos,
      edad: data.edad,
      grado: data.grado,
      fingerprint_right: data.fingerprint_right ?? null,
      fingerprint_left: data.fingerprint_left ?? null,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: student as Student }
}

export async function updateStudent(
  id: string,
  data: Partial<StudentFormData>
): Promise<{ success: boolean; error?: string; data?: Student }> {
  const supabase = await createClient()

  const { data: student, error } = await supabase
    .from('students')
    .update({
      ...(data.cedula !== undefined && { cedula: data.cedula }),
      ...(data.nombres !== undefined && { nombres: data.nombres }),
      ...(data.apellidos !== undefined && { apellidos: data.apellidos }),
      ...(data.edad !== undefined && { edad: data.edad }),
      ...(data.grado !== undefined && { grado: data.grado }),
      ...(data.fingerprint_right !== undefined && {
        fingerprint_right: data.fingerprint_right,
      }),
      ...(data.fingerprint_left !== undefined && {
        fingerprint_left: data.fingerprint_left,
      }),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: student as Student }
}

export async function deleteStudent(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.from('students').delete().eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
