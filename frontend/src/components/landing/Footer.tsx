import { Phone, Mail, MapPin } from "lucide-react";

// Lucide v1 dropped brand icons (Facebook / Instagram / YouTube) over
// trademark concerns. To avoid adding a whole new dependency for three
// icons we inline minimal monochrome SVGs that fit the same 16x16 slot.
type BrandIconProps = { className?: string };

function FacebookIcon({ className }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.87.24-1.46 1.5-1.46h1.6V4.43c-.28-.04-1.24-.12-2.36-.12-2.34 0-3.94 1.43-3.94 4.05V10.5H7.7v3h2.6V21h3.2z" />
    </svg>
  );
}

function InstagramIcon({ className }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function YoutubeIcon({ className }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M21.6 7.2c-.23-.87-.9-1.55-1.77-1.78C18.25 5 12 5 12 5s-6.25 0-7.83.42c-.87.23-1.55.91-1.77 1.78C2 8.78 2 12 2 12s0 3.22.4 4.8c.22.87.9 1.55 1.77 1.78C5.75 19 12 19 12 19s6.25 0 7.83-.42c.87-.23 1.55-.91 1.77-1.78.4-1.58.4-4.8.4-4.8s0-3.22-.4-4.8zM10 15V9l5 3-5 3z" />
    </svg>
  );
}

const quickLinks = [
  { label: "Inicio", href: "#inicio" },
  { label: "Quiénes somos", href: "#quienes-somos" },
  { label: "Programa", href: "#programa" },
  { label: "Niveles de formación", href: "#niveles" },
  { label: "¿Cómo funciona?", href: "#como-funciona" },
  { label: "Plataforma EduControl", href: "#plataforma" },
  { label: "Beneficios", href: "#beneficios" },
  { label: "Contacto", href: "#contacto" },
];

const social = [
  { icon: FacebookIcon, href: "#", label: "Facebook" },
  { icon: InstagramIcon, href: "#", label: "Instagram" },
  { icon: YoutubeIcon, href: "#", label: "YouTube" },
];

export default function Footer() {
  return (
    <footer className="bg-gray-950 text-white">
      {/* Gold top line */}
      <div className="h-1 bg-gradient-to-r from-[#8B0000] via-[#C9A84C] to-[#8B0000]" />

      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-4 mb-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logos/LOGO_HARVARD_CIRCULAR_NUEVO_SISTEMAS.png"
                alt="Harvard Enterprise"
                className="w-14 h-14 object-contain"
              />
              <div>
                <div className="font-bold text-white text-lg tracking-wide">
                  HARVARD ENTERPRISE
                </div>
                <div className="text-[#C9A84C] text-xs tracking-widest">S.A.S.</div>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-xs">
              Institución educativa con más de 20 años de trayectoria, dedicada
              a la formación académica complementaria con énfasis en inglés
              para niños y jóvenes de Soacha, Cundinamarca.
            </p>
            {/* Social */}
            <div className="flex gap-3">
              {social.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 bg-white/8 hover:bg-[#8B0000] border border-white/10 hover:border-[#8B0000] rounded-lg flex items-center justify-center transition-all duration-200"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="font-semibold text-white mb-5 text-sm uppercase tracking-widest">
              Navegación
            </h4>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-gray-400 hover:text-[#C9A84C] text-sm transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-white mb-5 text-sm uppercase tracking-widest">
              Información de contacto
            </h4>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <MapPin className="w-4 h-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
                <span className="text-gray-400 text-sm">
                  Soacha, Cundinamarca, Colombia
                </span>
              </li>
              <li className="flex gap-3">
                <Phone className="w-4 h-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
                <span className="text-gray-400 text-sm">+57 (1) 000-0000</span>
              </li>
              <li className="flex gap-3">
                <Mail className="w-4 h-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
                <span className="text-gray-400 text-sm">
                  info@harvardenterprise.edu.co
                </span>
              </li>
            </ul>

            <div className="mt-6">
              <a
                href="/login"
                className="inline-flex items-center gap-2 bg-[#8B0000] hover:bg-[#6b0000] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors w-full justify-center border border-[#C9A84C]/20"
              >
                Acceder a EduControl
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">
            © 2026 Harvard Enterprise S.A.S. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-1">
            <span className="text-gray-600 text-xs">Desarrollado por</span>
            <span className="text-[#C9A84C] text-xs font-semibold">
              EduControl Tech
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
