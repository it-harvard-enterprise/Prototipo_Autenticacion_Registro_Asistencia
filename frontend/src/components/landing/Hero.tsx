import { ChevronDown, Monitor, BookOpen } from "lucide-react";

export default function Hero() {
  return (
    <section
      id="inicio"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url(https://images.pexels.com/photos/5212345/pexels-photo-5212345.jpeg?auto=compress&cs=tinysrgb&w=1920)",
        }}
      />

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#8B0000]/90 via-[#5a0000]/80 to-black/85" />

      {/* Gold accent line top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#C9A84C] to-transparent" />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 text-center pt-24 pb-16">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-[#C9A84C]/20 border border-[#C9A84C]/50 text-[#C9A84C] px-5 py-2 rounded-full text-sm font-medium mb-8 backdrop-blur-sm">
          <BookOpen className="w-4 h-4" />
          Programa País Bilingüe — Soacha, Cundinamarca
        </div>

        {/* Title */}
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6 text-shadow">
          Formación académica
          <span className="block text-[#C9A84C]">para un futuro bilingüe</span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-gray-200 max-w-3xl mx-auto mb-10 leading-relaxed">
          Programa educativo complementario enfocado en inglés, con refuerzo en
          matemáticas y sistemas para niños y jóvenes.
        </p>

        {/* Stats row */}
        <div className="flex flex-wrap justify-center gap-8 mb-12">
          {[
            { value: "+20", label: "Años de experiencia" },
            { value: "4", label: "Niveles de inglés" },
            { value: "100%", label: "Enfoque académico" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-[#C9A84C] font-serif">
                {stat.value}
              </div>
              <div className="text-sm text-gray-300 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="#programa"
            className="inline-flex items-center justify-center gap-2 bg-[#C9A84C] hover:bg-[#b8930a] text-black font-semibold px-8 py-4 rounded-lg text-base transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            <BookOpen className="w-5 h-5" />
            Conoce el programa
          </a>
          <a
            href="/login"
            className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/40 hover:border-white/70 text-white font-semibold px-8 py-4 rounded-lg text-base transition-all duration-200 backdrop-blur-sm hover:-translate-y-0.5"
          >
            <Monitor className="w-5 h-5" />
            Acceder a Plataforma
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <a
        href="#quienes-somos"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 hover:text-[#C9A84C] transition-colors animate-bounce"
        aria-label="Ir a la siguiente sección"
      >
        <ChevronDown className="w-7 h-7" />
      </a>
    </section>
  );
}
