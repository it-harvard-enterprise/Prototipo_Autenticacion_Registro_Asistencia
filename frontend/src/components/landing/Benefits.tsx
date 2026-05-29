import {
  TrendingUp,
  BookCheck,
  Wallet,
  ClipboardCheck,
  Globe,
  GraduationCap,
} from "lucide-react";

const benefits = [
  {
    icon: TrendingUp,
    title: "Aprendizaje progresivo",
    description:
      "Estructura pedagógica diseñada para avanzar nivel a nivel, consolidando conocimientos antes de pasar al siguiente.",
  },
  {
    icon: BookCheck,
    title: "Refuerzo escolar",
    description:
      "Apoyo directo en matemáticas y sistemas que complementa el rendimiento académico en el colegio.",
  },
  {
    icon: Wallet,
    title: "Acceso económico",
    description:
      "Tarifas accesibles pensadas para familias de Soacha y municipios cercanos, sin sacrificar calidad.",
  },
  {
    icon: ClipboardCheck,
    title: "Seguimiento organizado",
    description:
      "Control detallado del progreso, asistencia y pagos a través de EduControl, la plataforma de gestión académica.",
  },
  {
    icon: Globe,
    title: "Enfoque en inglés",
    description:
      "Programa orientado al bilingüismo real, con metodologías activas que desarrollan las cuatro habilidades del idioma.",
  },
  {
    icon: GraduationCap,
    title: "Apoyo académico continuo",
    description:
      "Equipo docente comprometido con el desarrollo integral de cada estudiante a lo largo de todo el proceso formativo.",
  },
];

export default function Benefits() {
  return (
    <section id="beneficios" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-[#8B0000] text-sm font-semibold tracking-widest uppercase mb-4">
            <div className="h-px w-8 bg-[#C9A84C]" />
            Por qué elegirnos
            <div className="h-px w-8 bg-[#C9A84C]" />
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Beneficios para estudiantes y familias
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
            Harvard Enterprise S.A.S. ofrece una propuesta educativa completa,
            accesible y moderna que transforma la experiencia de aprendizaje
            para toda la familia.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {benefits.map(({ icon: Icon, title, description }, i) => (
            <div
              key={title}
              className="group relative bg-white border border-gray-100 rounded-2xl p-7 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 overflow-hidden"
            >
              {/* Decorative corner */}
              <div className="absolute top-0 right-0 w-16 h-16 bg-[#8B0000]/5 rounded-bl-3xl transition-all duration-300 group-hover:w-24 group-hover:h-24 group-hover:bg-[#8B0000]/8" />

              <div className="relative z-10">
                <div className="w-12 h-12 bg-[#8B0000]/10 group-hover:bg-[#8B0000]/15 rounded-xl flex items-center justify-center mb-5 transition-colors duration-300">
                  <Icon className="w-6 h-6 text-[#8B0000]" />
                </div>

                <div className="text-[#C9A84C] text-xs font-bold tracking-widest uppercase mb-2">
                  0{i + 1}
                </div>
                <h3 className="font-semibold text-gray-900 text-lg mb-2 leading-snug">
                  {title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Banner */}
        <div className="mt-16 bg-gradient-to-r from-[#8B0000] to-[#6b0000] rounded-3xl p-10 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-[#C9A84C] rounded-full -translate-y-1/2" />
            <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-white rounded-full translate-y-1/2" />
          </div>
          <div className="relative z-10">
            <div className="text-[#C9A84C] font-semibold text-sm tracking-widest uppercase mb-3">
              Proceso de matrícula abierto
            </div>
            <h3 className="font-serif text-3xl md:text-4xl font-bold mb-4">
              ¿Listo para comenzar?
            </h3>
            <p className="text-white/80 text-lg max-w-xl mx-auto mb-8">
              Inscribe a tu hijo hoy y dale la oportunidad de aprender inglés
              con una institución con más de 20 años de experiencia.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#contacto"
                className="bg-[#C9A84C] hover:bg-[#b8930a] text-black font-semibold px-8 py-4 rounded-xl transition-colors"
              >
                Matricular ahora
              </a>
              <a
                href="#programa"
                className="bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold px-8 py-4 rounded-xl transition-colors"
              >
                Conocer más
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
