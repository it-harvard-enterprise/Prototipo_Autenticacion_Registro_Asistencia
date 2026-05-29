import {
  Fingerprint,
  Users,
  CreditCard,
  Video,
  FileBarChart,
  Bell,
  Monitor,
} from "lucide-react";

const features = [
  {
    icon: Fingerprint,
    title: "Control de asistencia biométrica",
    description:
      "Registro automático de asistencia mediante tecnología biométrica, eliminando errores manuales.",
  },
  {
    icon: Users,
    title: "Gestión de estudiantes",
    description:
      "Administración centralizada de la información académica, datos personales y progreso de cada alumno.",
  },
  {
    icon: CreditCard,
    title: "Control de pagos",
    description:
      "Seguimiento de mensualidades, historial de pagos y generación de recibos de forma digital.",
  },
  {
    icon: Video,
    title: "Recuperaciones virtuales",
    description:
      "Gestión y programación de clases de recuperación en modalidad virtual para estudiantes ausentes.",
  },
  {
    icon: FileBarChart,
    title: "Reportes administrativos",
    description:
      "Generación de reportes académicos y administrativos detallados para la toma de decisiones.",
  },
  {
    icon: Bell,
    title: "Notificaciones a acudientes",
    description:
      "Comunicación directa con padres y acudientes sobre asistencia, calificaciones y avisos importantes.",
  },
];

export default function EduControl() {
  return (
    <section
      id="plataforma"
      className="py-24 bg-gray-900 text-white overflow-hidden relative"
    >
      {/* Decorative background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#8B0000] rounded-full translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#C9A84C] rounded-full -translate-x-1/3 translate-y-1/3" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 md:px-8 lg:px-16">
        <div className="grid lg:grid-cols-2 gap-16 items-center mb-16">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 bg-[#C9A84C]/15 border border-[#C9A84C]/30 text-[#C9A84C] px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
              <Monitor className="w-4 h-4" />
              Tecnología educativa
            </div>
            <h2 className="font-serif text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Plataforma <span className="text-[#C9A84C]">EduControl</span>
            </h2>
            <div className="w-16 h-1 bg-[#8B0000] mb-8 rounded-full" />
            <p className="text-gray-300 text-lg leading-relaxed mb-6">
              EduControl será la plataforma tecnológica conectada al sistema
              académico de Harvard Enterprise, diseñada para mejorar la gestión
              de estudiantes, asistencia, pagos, recuperaciones y reportes
              administrativos.
            </p>
            <p className="text-gray-400 text-base leading-relaxed mb-8">
              Una herramienta moderna que integra todos los procesos de la
              institución en un solo lugar, accesible para docentes, directivos,
              estudiantes y familias.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="/login"
                className="inline-flex items-center justify-center gap-2 bg-[#8B0000] hover:bg-[#6b0000] text-white font-semibold px-6 py-3.5 rounded-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#8B0000]/30"
              >
                <Monitor className="w-4 h-4" />
                Acceder a Plataforma
              </a>
              <div className="inline-flex items-center gap-2 border border-white/20 text-white/70 px-6 py-3.5 rounded-lg text-sm">
                <div className="w-2 h-2 rounded-full bg-[#C9A84C] animate-pulse" />
                Próximamente disponible
              </div>
            </div>
          </div>

          {/* Right: mockup card */}
          <div className="relative">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
              {/* Mock browser bar */}
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/10">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <div className="flex-1 bg-white/10 rounded-lg px-3 py-1 text-center text-xs text-gray-400">
                  educontrol.harvardenterprise.edu.co
                </div>
              </div>

              {/* Mock dashboard */}
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1 bg-[#8B0000]/30 rounded-xl p-4">
                    <div className="text-[#C9A84C] text-xs font-semibold mb-1">
                      Asistencia hoy
                    </div>
                    <div className="text-white text-2xl font-bold">94%</div>
                  </div>
                  <div className="flex-1 bg-white/8 rounded-xl p-4">
                    <div className="text-gray-400 text-xs font-semibold mb-1">
                      Estudiantes
                    </div>
                    <div className="text-white text-2xl font-bold">128</div>
                  </div>
                </div>
                <div className="bg-white/8 rounded-xl p-4">
                  <div className="text-gray-400 text-xs font-semibold mb-3">
                    Pagos recientes
                  </div>
                  <div className="space-y-2">
                    {[
                      "Nivel A1 — Grupo A",
                      "Nivel B1 — Grupo C",
                      "Nivel A2 — Grupo B",
                    ].map((g) => (
                      <div key={g} className="flex items-center justify-between">
                        <span className="text-gray-300 text-xs">{g}</span>
                        <span className="text-emerald-400 text-xs font-semibold">
                          Al día
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 bg-[#C9A84C]/15 border border-[#C9A84C]/20 rounded-xl p-3 text-center">
                    <div className="text-[#C9A84C] text-xs font-semibold">Reportes</div>
                  </div>
                  <div className="flex-1 bg-white/8 rounded-xl p-3 text-center">
                    <div className="text-gray-300 text-xs">Recuperaciones</div>
                  </div>
                  <div className="flex-1 bg-white/8 rounded-xl p-3 text-center">
                    <div className="text-gray-300 text-xs">Notificar</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group bg-white/5 hover:bg-white/8 border border-white/10 hover:border-[#C9A84C]/30 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="w-11 h-11 bg-[#8B0000]/30 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#8B0000]/50 transition-colors">
                <Icon className="w-5 h-5 text-[#C9A84C]" />
              </div>
              <h3 className="font-semibold text-white mb-2 text-sm">{title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
