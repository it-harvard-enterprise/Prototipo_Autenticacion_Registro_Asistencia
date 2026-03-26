'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { updateCourse } from '@/app/actions/courses'
import { Course } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const courseSchema = z.object({
  name: z
    .string()
    .min(2, 'El nombre del curso es requerido')
    .max(100, 'Nombre demasiado largo'),
  description: z.string().max(500, 'Descripción demasiado larga').optional(),
  schedule: z.string().max(200, 'Horario demasiado largo').optional(),
})

type CourseFormValues = z.infer<typeof courseSchema>

export default function EditCoursePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [course, setCourse] = useState<Course | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      name: '',
      description: '',
      schedule: '',
    },
  })

  useEffect(() => {
    async function fetchCourse() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        setFetchError('No se encontró el curso')
        setIsFetching(false)
        return
      }

      const c = data as Course
      setCourse(c)
      form.reset({
        name: c.name,
        description: c.description ?? '',
        schedule: c.schedule ?? '',
      })
      setIsFetching(false)
    }

    fetchCourse()
  }, [id, form])

  async function onSubmit(values: CourseFormValues) {
    setIsLoading(true)

    const result = await updateCourse(id, {
      name: values.name,
      description: values.description || null,
      schedule: values.schedule || null,
    })

    if (result.success) {
      toast.success('Curso actualizado correctamente')
      router.push(`/dashboard/courses/${id}`)
      router.refresh()
    } else {
      toast.error(result.error ?? 'Error al actualizar el curso')
      setIsLoading(false)
    }
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-600">{fetchError}</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/dashboard/courses">Volver a Cursos</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href={`/dashboard/courses/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar Curso</h1>
          <p className="text-gray-500 mt-0.5 text-sm">{course?.name}</p>
        </div>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Información del Curso</CardTitle>
          <CardDescription>Modifique los datos del curso</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Curso *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="schedule"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horario</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  disabled={isLoading}
                >
                  <Link href={`/dashboard/courses/${id}`}>Cancelar</Link>
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar Cambios'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
