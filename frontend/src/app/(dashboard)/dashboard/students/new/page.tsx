'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Fingerprint, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { createStudent } from '@/app/actions/students'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const studentSchema = z.object({
  cedula: z.string().min(1, 'La cédula es requerida').max(20, 'Cédula demasiado larga'),
  nombres: z.string().min(2, 'Los nombres son requeridos').max(100),
  apellidos: z.string().min(2, 'Los apellidos son requeridos').max(100),
  edad: z
    .string()
    .min(1, 'La edad es requerida')
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0 && Number(val) < 120, {
      message: 'Ingrese una edad válida',
    }),
  grado: z.string().min(1, 'El grado es requerido').max(50),
})

type StudentFormValues = z.infer<typeof studentSchema>

export default function NewStudentPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      cedula: '',
      nombres: '',
      apellidos: '',
      edad: '',
      grado: '',
    },
  })

  async function onSubmit(values: StudentFormValues) {
    setIsLoading(true)

    const result = await createStudent({
      cedula: values.cedula,
      nombres: values.nombres,
      apellidos: values.apellidos,
      edad: Number(values.edad),
      grado: values.grado,
      fingerprint_right: null,
      fingerprint_left: null,
    })

    if (result.success) {
      toast.success('Estudiante creado correctamente')
      router.push('/dashboard/students')
      router.refresh()
    } else {
      toast.error(result.error ?? 'Error al crear el estudiante')
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/students">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Estudiante</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Complete el formulario para registrar un nuevo estudiante
          </p>
        </div>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Información Personal</CardTitle>
          <CardDescription>Datos de identificación del estudiante</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="cedula"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cédula *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: 1234567890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nombres"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombres *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Juan Carlos" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="apellidos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellidos *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Pérez García" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="edad"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Edad *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Ej: 15"
                          min={1}
                          max={120}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="grado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grado *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: 10° A" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Fingerprint section */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">
                    Registro de Huellas Dactilares
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Requiere lector Digital Persona 4500
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Card className="border-dashed border-gray-300">
                    <CardContent className="flex flex-col items-center justify-center p-5 gap-3">
                      <div className="rounded-full bg-gray-100 p-3">
                        <Fingerprint className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-700">
                          Índice Derecho
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">No registrada</p>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled
                          className="text-xs"
                        >
                          Capturar Huella
                        </Button>
                        <Badge
                          variant="secondary"
                          className="text-xs bg-amber-50 text-amber-700 border-amber-200"
                        >
                          Pendiente: Digital Persona 4500
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-dashed border-gray-300">
                    <CardContent className="flex flex-col items-center justify-center p-5 gap-3">
                      <div className="rounded-full bg-gray-100 p-3">
                        <Fingerprint className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-700">
                          Índice Izquierdo
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">No registrada</p>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled
                          className="text-xs"
                        >
                          Capturar Huella
                        </Button>
                        <Badge
                          variant="secondary"
                          className="text-xs bg-amber-50 text-amber-700 border-amber-200"
                        >
                          Pendiente: Digital Persona 4500
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  disabled={isLoading}
                >
                  <Link href="/dashboard/students">Cancelar</Link>
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar Estudiante'
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
