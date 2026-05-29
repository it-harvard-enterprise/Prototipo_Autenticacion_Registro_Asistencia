import { Award, MapPin, Globe, Users } from "lucide-react";

const highlights = [
  {
    icon: Award,
    title: "Más de 20 años de trayectoria",
    desc: "Décadas formando estudiantes con excelencia académica.",
  },
  {
    icon: MapPin,
    title: "Ubicados en Soacha",
    desc: "Cundinamarca, Colombia — al servicio de la comunidad.",
  },
  {
    icon: Globe,
    title: "Programa País Bilingüe",
    desc: "Alineados con los estándares nacionales de bilingüismo.",
  },
  {
    icon: Users,
    title: "Formación para niños y jóvenes",
    desc: "Desde los primeros niveles hasta preparación avanzada.",
  },
];

export default function About() {
  return (
    <section id="quienes-somos" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16">
        {/* Section label */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 max-w-[48px] bg-[#C9A84C]" />
          <span className="text-[#8B0000] text-sm font-semibold tracking-widest uppercase">
            Nuestra institución
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Text */}
          <div>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
              Quiénes somos
            </h2>
            <div className="w-16 h-1 bg-[#C9A84C] mb-8 rounded-full" />
            <p className="text-gray-600 text-lg leading-relaxed mb-6">
              <strong className="text-gray-900">Harvard Enterprise S.A.S.</strong>{" "}
              es una institución educativa ubicada en Soacha, Cundinamarca,
              dedicada al desarrollo de programas de formación académica
              complementaria para niños y jóvenes.
            </p>
            <p className="text-gray-600 text-lg leading-relaxed mb-6">
              Cuenta con más de dos décadas de trayectoria en el sector
              educativo, brindando acompañamiento académico con énfasis en el
              fortalecimiento del idioma inglés, acompañado de refuerzo en
              matemáticas y habilidades digitales.
            </p>
            <p className="text-gray-600 text-lg leading-relaxed mb-8">
              Nuestro modelo formativo está diseñado para ofrecer un aprendizaje
              progresivo, estructurado y accesible para toda la familia, con
              clases los días sábados y un equipo docente comprometido con el
              desarrollo integral de cada estudiante.
            </p>
            <a
              href="#programa"
              className="inline-flex items-center gap-2 text-[#8B0000] font-semibold hover:gap-3 transition-all duration-200"
            >
              Conocer el programa
              <span className="text-[#C9A84C]">→</span>
            </a>
          </div>

          {/* Right: Highlights grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {highlights.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group p-6 bg-gray-50 border border-gray-100 rounded-2xl hover:border-[#C9A84C]/40 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-[#8B0000]/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#8B0000]/15 transition-colors">
                  <Icon className="w-6 h-6 text-[#8B0000]" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 text-sm leading-snug">
                  {title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}

            {/* Experience card */}
            <div className="sm:col-span-2 p-6 bg-[#8B0000] rounded-2xl text-white">
              <div className="flex items-center gap-6">
                <div className="flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logos/LOGO_HARVARD_CIRCULAR_NUEVO_SISTEMAS.png"
                    alt="Harvard Enterprise"
                    className="w-20 h-20 object-contain"
                  />
                </div>
                <div>
                  <div className="text-[#C9A84C] font-serif text-4xl font-bold">
                    +20
                  </div>
                  <div className="text-white font-semibold">
                    Años formando generaciones
                  </div>
                  <div className="text-white/70 text-sm mt-1">
                    Una historia de compromiso con la educación en Soacha
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
