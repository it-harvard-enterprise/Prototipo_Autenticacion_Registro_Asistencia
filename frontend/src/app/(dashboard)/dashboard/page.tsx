import { createClient } from '@/lib/supabase/server'
import { Users, BookOpen, ClipboardList, FileSpreadsheet } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user?.id ?? '')
    .single()

  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : user?.user_metadata?.first_name
    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
    : user?.email

  const [{ count: studentsCount }, { count: coursesCount }] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('courses').select('*', { count: 'exact', head: true }),
  ])

  const stats = [
    {
      title: 'Total Estudiantes',
      value: studentsCount ?? 0,
      description: 'Estudiantes registrados',
      icon: Users,
      color: 'text-[#b92f2d]',
      bg: 'bg-[#b92f2d]/10',
    },
    {
      title: 'Total Cursos',
      value: coursesCount ?? 0,
      description: 'Cursos registrados',
      icon: BookOpen,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      title: 'Asistencia',
      value: '—',
      description: 'Próximamente disponible',
      icon: ClipboardList,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      disabled: true,
    },
    {
      title: 'Exportar',
      value: '—',
      description: 'Próximamente disponible',
      icon: FileSpreadsheet,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      disabled: true,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {displayName}
        </h1>
        <p className="text-gray-500 mt-1">
          Resumen general del sistema de asistencia
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card
              key={stat.title}
              className={stat.disabled ? 'opacity-60' : ''}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  {stat.value}
                </div>
                <CardDescription className="mt-1">
                  {stat.description}
                </CardDescription>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
