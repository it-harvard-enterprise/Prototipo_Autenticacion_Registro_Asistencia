import { CheckCircle, Mic, Pen, BookOpen, Headphones, FileText } from "lucide-react";

const levels = [
  {
    code: "A1",
    name: "Básico",
    description:
      "Introducción al idioma. Vocabulario esencial, saludos, presentaciones y estructuras gramaticales simples.",
    skills: ["Vocabulario cotidiano", "Gramática básica", "Frases sencillas"],
    color: "from-emerald-500 to-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    badge: "bg-emerald-100 text-emerald-800",
  },
  {
    code: "A2",
    name: "Básico-Intermedio",
    description:
      "Ampliación del vocabulario y estructuras gramaticales. Comunicación básica en situaciones cotidianas.",
    skills: [
      "Tiempo pasado y presente",
      "Conversaciones simples",
      "Comprensión de textos",
    ],
    color: "from-blue-500 to-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-800",
  },
  {
    code: "B1",
    name: "Intermedio",
    description:
      "Comunicación fluida en contextos familiares. Comprensión de textos de mediana complejidad y expresión oral continua.",
    skills: [
      "Expresión oral fluida",
      "Escritura estructurada",
      "Comprensión auditiva",
    ],
    color: "from-[#C9A84C] to-amber-500",
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-800",
  },
  {
    code: "B2",
    name: "Avanzado",
    description:
      "Dominio del idioma en contextos académicos y profesionales. Análisis crítico y producción de textos complejos.",
    skills: [
      "Debates y argumentación",
      "Textos académicos",
      "Vocabulario avanzado",
    ],
    color: "from-[#8B0000] to-red-800",
    bg: "bg-red-50",
    border: "border-red-200",
    badge: "bg-red-100 text-red-800",
  },
];

const testSkills = [
  { icon: BookOpen, label: "Reading", desc: "Comprensión lectora" },
  { icon: Pen, label: "Writing", desc: "Producción escrita" },
  { icon: Mic, label: "Speaking", desc: "Expresión oral" },
  { icon: Headphones, label: "Listening", desc: "Comprensión auditiva" },
  { icon: FileText, label: "Grammar", desc: "Gramática y estructura" },
];

export default function Levels() {
  return (
    <section id="niveles" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-[#8B0000] text-sm font-semibold tracking-widest uppercase mb-4">
            <div className="h-px w-8 bg-[#C9A84C]" />
            Marco Común Europeo
            <div className="h-px w-8 bg-[#C9A84C]" />
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Niveles de formación
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
            Nuestro programa sigue los estándares internacionales del Marco
            Común Europeo de Referencia (MCER), garantizando un aprendizaje
            progresivo y certificable.
          </p>
        </div>

        {/* Levels grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {levels.map((level, i) => (
            <div
              key={level.code}
              className={`group rounded-2xl overflow-hidden border ${level.border} hover:shadow-xl transition-all duration-300 hover:-translate-y-2`}
            >
              {/* Header */}
              <div className={`bg-gradient-to-br ${level.color} p-6 text-white`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-white/70 text-xs font-semibold tracking-widest uppercase">
                      Nivel {i + 1}
                    </span>
                    <div className="font-serif text-4xl font-bold mt-1">
                      {level.code}
                    </div>
                  </div>
                  <div className="bg-white/20 rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold">
                    {i + 1}
                  </div>
                </div>
                <div className="text-white/90 font-semibold">{level.name}</div>
              </div>

              {/* Body */}
              <div className={`${level.bg} p-5`}>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">
                  {level.description}
                </p>
                <ul className="space-y-2">
                  {level.skills.map((skill) => (
                    <li key={skill} className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#8B0000] flex-shrink-0" />
                      <span className="text-gray-700 text-sm">{skill}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Placement Test */}
        <div className="bg-gray-900 rounded-3xl p-8 md:p-10 text-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-block bg-[#C9A84C]/20 border border-[#C9A84C]/40 text-[#C9A84C] px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
                Prueba de clasificación
              </div>
              <h3 className="font-serif text-3xl font-bold mb-3">
                Examen de nivelación
              </h3>
              <p className="text-gray-400 text-base max-w-xl mx-auto">
                Los estudiantes de{" "}
                <strong className="text-white">sexto grado en adelante</strong>{" "}
                pueden presentar una prueba de clasificación para ser ubicados
                en el nivel correspondiente a sus conocimientos previos.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {testSkills.map(({ icon: Icon, label, desc }) => (
                <div
                  key={label}
                  className="bg-white/8 hover:bg-white/12 border border-white/10 rounded-2xl p-4 text-center transition-colors"
                >
                  <div className="w-10 h-10 bg-[#8B0000]/30 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Icon className="w-5 h-5 text-[#C9A84C]" />
                  </div>
                  <div className="font-bold text-white text-sm">{label}</div>
                  <div className="text-gray-400 text-xs mt-1">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
