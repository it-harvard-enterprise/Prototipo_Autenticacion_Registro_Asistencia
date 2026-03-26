import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { StudentsTable } from '@/components/students-table'
import { Student } from '@/lib/types'

export default async function StudentsPage() {
  const supabase = await createClient()

  const { data: students, error } = await supabase
    .from('students')
    .select('*')
    .order('apellidos', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estudiantes</h1>
          <p className="text-gray-500 mt-1">
            Gestión de estudiantes registrados en el sistema
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/students/new">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Estudiante
          </Link>
        </Button>
      </div>

      {error ? (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">
            Error al cargar los estudiantes: {error.message}
          </p>
        </div>
      ) : (
        <StudentsTable students={(students ?? []) as Student[]} />
      )}
    </div>
  )
}
