import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Pencil, Fingerprint } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Student } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface StudentDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function StudentDetailPage({
  params,
}: StudentDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: student, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !student) {
    notFound()
  }

  const s = student as Student

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
          <Link href="/dashboard/students">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {s.nombres} {s.apellidos}
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">Cédula: {s.cedula}</p>
        </div>
        <Button asChild>
          <Link href={`/dashboard/students/${s.id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </Button>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Información Personal</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cédula
              </dt>
              <dd className="mt-1 text-sm font-mono text-gray-900">{s.cedula}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Grado
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{s.grado}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombres
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{s.nombres}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Apellidos
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{s.apellidos}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Edad
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{s.edad} años</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Huellas Dactilares</CardTitle>
          <CardDescription>
            Estado del registro biométrico del estudiante
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border">
              <Fingerprint className="h-5 w-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Índice Derecho</p>
              </div>
              {s.fingerprint_right ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  Registrada
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-gray-500">
                  No registrada
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border">
              <Fingerprint className="h-5 w-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Índice Izquierdo</p>
              </div>
              {s.fingerprint_left ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  Registrada
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-gray-500">
                  No registrada
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-50 max-w-2xl mx-auto">
        <CardContent className="pt-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            <div>
              <dt className="text-xs font-medium text-gray-500">Creado</dt>
              <dd className="text-xs text-gray-600">{formatDate(s.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">
                Última actualización
              </dt>
              <dd className="text-xs text-gray-600">{formatDate(s.updated_at)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
