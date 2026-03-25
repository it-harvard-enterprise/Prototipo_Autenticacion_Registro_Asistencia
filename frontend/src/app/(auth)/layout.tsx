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
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 py-8">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-semibold text-slate-900 tracking-tight">
          SysAsistencia
        </h1>
        <p className="text-slate-500 mt-2 text-base">
          Sistema de Registro de Asistencia
        </p>
      </div>
      <div className="w-full max-w-lg">{children}</div>
    </div>
  )
}
