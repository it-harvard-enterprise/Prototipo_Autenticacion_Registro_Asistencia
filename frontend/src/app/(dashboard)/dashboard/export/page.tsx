import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function ExportPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="pb-4">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-purple-100 p-5">
              <FileSpreadsheet className="h-10 w-10 text-purple-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Exportar a Excel</CardTitle>
          <CardDescription className="text-base mt-1">
            Esta funcionalidad estará disponible próximamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 mb-6">
            Próximamente podrá exportar los registros de asistencia, estudiantes
            y cursos a archivos de Excel para su análisis y reporte.
          </p>
          <Button disabled className="w-full">
            Próximamente disponible
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
