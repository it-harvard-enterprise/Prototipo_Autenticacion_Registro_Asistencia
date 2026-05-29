"use client";

import { useState, useEffect } from "react";
import { Menu, X, Monitor } from "lucide-react";

const navLinks = [
  { label: "Inicio", href: "#inicio" },
  { label: "Quiénes somos", href: "#quienes-somos" },
  { label: "Programa", href: "#programa" },
  { label: "Niveles", href: "#niveles" },
  { label: "Beneficios", href: "#beneficios" },
  { label: "Contacto", href: "#contacto" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white shadow-lg border-b-2 border-[#C9A84C]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <a href="#inicio" className="flex items-center gap-3 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/LOGO_HARVARD_CIRCULAR_NUEVO_SISTEMAS.png"
              alt="Harvard Enterprise"
              className="h-12 w-12 object-contain"
            />
            <div className="hidden sm:block">
              <div
                className={`font-bold text-sm leading-tight transition-colors ${
                  scrolled ? "text-[#8B0000]" : "text-white"
                }`}
              >
                HARVARD ENTERPRISE
              </div>
              <div
                className={`text-xs tracking-widest transition-colors ${
                  scrolled ? "text-[#C9A84C]" : "text-[#C9A84C]"
                }`}
              >
                S.A.S.
              </div>
            </div>
          </a>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 hover:text-[#8B0000] hover:bg-red-50 ${
                  scrolled
                    ? "text-gray-700"
                    : "text-white hover:bg-white/10 hover:text-white"
                }`}
              >
                {link.label}
              </a>
            ))}
            <a
              href="/login"
              className="ml-4 flex items-center gap-2 bg-[#8B0000] hover:bg-[#6b0000] text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg border border-[#C9A84C]/40"
            >
              <Monitor className="w-4 h-4" />
              Plataforma
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`lg:hidden p-2 rounded-lg transition-colors ${
              scrolled
                ? "text-gray-700 hover:bg-gray-100"
                : "text-white hover:bg-white/10"
            }`}
            aria-label="Menú"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`lg:hidden bg-white border-t border-gray-100 shadow-xl transition-all duration-300 overflow-hidden ${
          isOpen ? "max-h-screen opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 py-4 space-y-1">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="block px-4 py-3 text-gray-700 font-medium rounded-lg hover:bg-red-50 hover:text-[#8B0000] transition-colors"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-3 pb-1">
            <a
              href="/login"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 w-full bg-[#8B0000] hover:bg-[#6b0000] text-white px-5 py-3 rounded-lg font-semibold transition-colors"
            >
              <Monitor className="w-4 h-4" />
              Acceder a Plataforma
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
