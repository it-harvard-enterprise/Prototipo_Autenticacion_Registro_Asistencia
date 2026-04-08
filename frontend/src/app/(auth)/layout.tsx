import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "SysAsistencia - Acceso",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col-reverse items-center justify-center gap-10 lg:grid lg:grid-cols-2 lg:gap-16">
        <div className="w-full max-w-lg">
          <div className="mb-8 text-center lg:text-left">
            <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">
              SysAsistencia - Harvard Enterprise
            </h1>
            <p className="text-gray-500 mt-2 text-base">
              Sistema de Creación de Estudiantes, Cursos y Registro de
              Asistencia de Harvard Enterprise.
            </p>
          </div>
          {children}
        </div>

        <div className="text-center lg:text-right">
          <div className="flex justify-center lg:justify-end pb-4">
            <Image
              src="/logos/Logo_Nuevo.png"
              alt="Logo Harvard Enterprise"
              width={500}
              height={500}
              className="h-[500px] w-[500px]"
              priority
            />
          </div>
        </div>
      </div>
    </div>
  );
}
