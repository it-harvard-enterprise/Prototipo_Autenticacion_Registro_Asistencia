import { Globe, Calculator, Monitor, BookOpenCheck } from "lucide-react";

const programs = [
  {
    icon: Globe,
    title: "Inglés",
    level: "Énfasis principal",
    description:
      "Fortalecimiento del idioma inglés desde niveles iniciales hasta niveles avanzados, siguiendo los estándares del Marco Común Europeo de Referencia.",
    color: "bg-[#8B0000]",
    accent: "text-[#C9A84C]",
  },
  {
    icon: Calculator,
    title: "Matemáticas",
    level: "Refuerzo académico",
    description:
      "Refuerzo académico para apoyar el desempeño escolar, fortaleciendo habilidades lógicas y numéricas que complementan el aprendizaje formal.",
    color: "bg-gray-900",
    accent: "text-[#C9A84C]",
  },
  {
    icon: Monitor,
    title: "Sistemas",
    level: "Habilidades digitales",
    description:
      "Desarrollo de habilidades digitales y uso responsable de la tecnología, preparando a los estudiantes para el mundo conectado.",
    color: "bg-[#C9A84C]",
    accent: "text-gray-900",
  },
  {
    icon: BookOpenCheck,
    title: "Acompañamiento académico",
    level: "Proceso formativo",
    description:
      "Proceso formativo progresivo, diseñado para niños y jóvenes, con seguimiento personalizado y metodologías activas de aprendizaje.",
    color: "bg-white border-2 border-[#8B0000]",
    accent: "text-[#8B0000]",
  },
];

export default function Program() {
  return (
    <section id="programa" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-[#8B0000] text-sm font-semibold tracking-widest uppercase mb-4">
            <div className="h-px w-8 bg-[#C9A84C]" />
            Nuestra oferta educativa
            <div className="h-px w-8 bg-[#C9A84C]" />
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Programa País Bilingüe
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
            Un programa integral que combina el aprendizaje del inglés con
            refuerzo en áreas clave, diseñado para maximizar el potencial
            académico de cada estudiante.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {programs.map(({ icon: Icon, title, level, description, color, accent }) => (
            <div
              key={title}
              className="group flex flex-col rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2"
            >
              {/* Card header */}
              <div className={`${color} p-6 flex items-start justify-between`}>
                <div>
                  <div
                    className={`text-xs font-semibold uppercase tracking-widest mb-2 ${
                      color.includes("white") ? "text-[#8B0000]/60" : "text-white/60"
                    }`}
                  >
                    {level}
                  </div>
                  <h3
                    className={`font-serif text-xl font-bold ${
                      color.includes("white") ? "text-gray-900" : "text-white"
                    }`}
                  >
                    {title}
                  </h3>
                </div>
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    color.includes("white") ? "bg-[#8B0000]/10" : "bg-white/15"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${color.includes("white") ? "text-[#8B0000]" : accent}`}
                  />
                </div>
              </div>

              {/* Card body */}
              <div className="flex-1 bg-white p-6 border border-gray-100 border-t-0">
                <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <div className="mt-12 p-6 bg-white rounded-2xl border border-[#C9A84C]/30 flex flex-col md:flex-row items-center gap-4 text-center md:text-left shadow-sm">
          <div className="w-14 h-14 bg-[#8B0000]/10 rounded-full flex items-center justify-center flex-shrink-0">
            <BookOpenCheck className="w-7 h-7 text-[#8B0000]" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Clases los días sábados</p>
            <p className="text-gray-500 text-sm">
              Sesiones de <strong>2 horas y media</strong> diseñadas para no
              interferir con la jornada escolar regular, ofreciendo un
              aprendizaje complementario efectivo.
            </p>
          </div>
          <a
            href="#como-funciona"
            className="md:ml-auto flex-shrink-0 bg-[#8B0000] hover:bg-[#6b0000] text-white px-6 py-3 rounded-lg font-medium text-sm transition-colors"
          >
            ¿Cómo funciona?
          </a>
        </div>
      </div>
    </section>
  );
}
