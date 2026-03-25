'use server'

import { createClient } from '@/lib/supabase/server'
import { Course } from '@/lib/types'

export interface CourseFormData {
  name: string
  description?: string | null
  schedule?: string | null
}

export async function createCourse(
  data: CourseFormData
): Promise<{ success: boolean; error?: string; data?: Course }> {
  const supabase = await createClient()

  const { data: course, error } = await supabase
    .from('courses')
    .insert({
      name: data.name,
      description: data.description ?? null,
      schedule: data.schedule ?? null,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: course as Course }
}

export async function updateCourse(
  id: string,
  data: Partial<CourseFormData>
): Promise<{ success: boolean; error?: string; data?: Course }> {
  const supabase = await createClient()

  const { data: course, error } = await supabase
    .from('courses')
    .update({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.schedule !== undefined && { schedule: data.schedule }),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: course as Course }
}

export async function deleteCourse(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.from('courses').delete().eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
