import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SysAsistencia - Acceso',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          SysAsistencia
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Sistema de Registro de Asistencia
        </p>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
