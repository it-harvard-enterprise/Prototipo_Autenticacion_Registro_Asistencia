import { ClipboardList, Users, Calendar, BarChart2, Monitor } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: ClipboardList,
    title: "Matrícula del estudiante",
    description:
      "El proceso inicia con el diligenciamiento del formulario de matrícula, la presentación de documentos y el pago de inscripción.",
  },
  {
    number: "02",
    icon: Users,
    title: "Asignación de grupo y horario",
    description:
      "El estudiante es ubicado en el grupo correspondiente a su nivel y se le asigna un horario los días sábados.",
  },
  {
    number: "03",
    icon: Calendar,
    title: "Clases los días sábados",
    description:
      "Las clases se realizan cada sábado con una duración de dos horas y media por sesión, permitiendo un aprendizaje constante sin interrumpir la jornada escolar.",
  },
  {
    number: "04",
    icon: BarChart2,
    title: "Seguimiento académico",
    description:
      "El progreso de cada estudiante es monitoreado de forma continua. Se generan reportes periódicos para padres y acudientes.",
  },
  {
    number: "05",
    icon: Monitor,
    title: "Acceso a la plataforma",
    description:
      "Mediante EduControl, estudiantes y familias podrán consultar asistencia, calificaciones, pagos y notificaciones en línea.",
  },
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-[#8B0000] text-sm font-semibold tracking-widest uppercase mb-4">
            <div className="h-px w-8 bg-[#C9A84C]" />
            Proceso de aprendizaje
            <div className="h-px w-8 bg-[#C9A84C]" />
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            ¿Cómo funciona el programa?
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
            Un proceso claro y estructurado para que cada familia sepa qué
            esperar desde el primer día hasta el seguimiento continuo del
            aprendizaje.
          </p>
        </div>

        <div className="relative">
          {/* Connector line desktop */}
          <div className="hidden lg:block absolute top-16 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-[#8B0000] via-[#C9A84C] to-[#8B0000] opacity-20" />

          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-8">
            {steps.map((step, i) => (
              <div
                key={step.number}
                className="relative flex flex-col items-center text-center group"
              >
                {/* Step bubble */}
                <div className="relative mb-6">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl ${
                      i === 2
                        ? "bg-[#8B0000]"
                        : "bg-white border-2 border-[#8B0000]/20 group-hover:border-[#8B0000]/50"
                    }`}
                  >
                    <step.icon
                      className={`w-7 h-7 ${i === 2 ? "text-[#C9A84C]" : "text-[#8B0000]"}`}
                    />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#C9A84C] flex items-center justify-center">
                    <span className="text-[10px] font-bold text-black">
                      {step.number}
                    </span>
                  </div>
                </div>

                <h3 className="font-semibold text-gray-900 text-sm mb-2 leading-snug">
                  {step.title}
                </h3>
                <p className="text-gray-500 text-xs leading-relaxed">
                  {step.description}
                </p>

                {/* Arrow (desktop only, not last) */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 -right-4 text-[#C9A84C] text-lg font-bold z-10">
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Highlight box */}
        <div className="mt-16 bg-[#8B0000] rounded-2xl p-8 flex flex-col md:flex-row items-center gap-6 text-white text-center md:text-left">
          <div className="w-16 h-16 bg-[#C9A84C]/20 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Calendar className="w-8 h-8 text-[#C9A84C]" />
          </div>
          <div className="flex-1">
            <h3 className="font-serif text-xl font-bold mb-1">Clases cada sábado</h3>
            <p className="text-white/80 text-sm">
              Sesiones de{" "}
              <strong className="text-[#C9A84C]">2 horas y 30 minutos</strong>{" "}
              cada sábado, pensadas para no interferir con el horario escolar de
              los estudiantes. Un modelo flexible y comprometido con el
              bienestar de toda la familia.
            </p>
          </div>
          <a
            href="#contacto"
            className="flex-shrink-0 bg-[#C9A84C] hover:bg-[#b8930a] text-black font-semibold px-6 py-3 rounded-lg text-sm transition-colors"
          >
            Matricular ahora
          </a>
        </div>
      </div>
    </section>
  );
}
