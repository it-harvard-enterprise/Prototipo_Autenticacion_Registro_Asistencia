import { ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function AttendancePage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="pb-4">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-amber-100 p-5">
              <ClipboardList className="h-10 w-10 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Tomar Asistencia</CardTitle>
          <CardDescription className="text-base mt-1">
            Esta funcionalidad estará disponible próximamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-6">
            La integración con el lector de huellas dactilares Digital Persona
            4500 está en desarrollo. Pronto podrá registrar la asistencia de
            los estudiantes de forma biométrica.
          </p>
          <Button disabled className="w-full">
            Próximamente disponible
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
