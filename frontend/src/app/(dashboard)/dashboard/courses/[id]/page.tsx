import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Course } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface CourseDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function CourseDetailPage({
  params,
}: CourseDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: course, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !course) {
    notFound()
  }

  const c = course as Course

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/courses">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{c.name}</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Detalle del curso</p>
        </div>
        <Button asChild>
          <Link href={`/dashboard/courses/${c.id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </Button>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Información del Curso</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombre
              </dt>
              <dd className="mt-1 text-sm text-gray-900 font-medium">{c.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Descripción
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {c.description ?? (
                  <span className="text-gray-400 italic">Sin descripción</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Horario
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {c.schedule ?? (
                  <span className="text-gray-400 italic">Sin horario asignado</span>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="bg-gray-50 max-w-2xl mx-auto">
        <CardContent className="pt-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            <div>
              <dt className="text-xs font-medium text-gray-500">Creado</dt>
              <dd className="text-xs text-gray-600">{formatDate(c.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">
                Última actualización
              </dt>
              <dd className="text-xs text-gray-600">{formatDate(c.updated_at)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
