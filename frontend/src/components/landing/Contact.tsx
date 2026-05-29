"use client";

import { useState } from "react";
import { MapPin, Phone, Mail, Send, CheckCircle } from "lucide-react";

export default function Contact() {
  const [form, setForm] = useState({
    nombre: "",
    telefono: "",
    correo: "",
    mensaje: "",
  });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // TODO: cuando exista un endpoint de contacto, reemplazar este sleep por
    // una llamada real (POST /api/contact, por ejemplo).
    await new Promise((r) => setTimeout(r, 1000));
    setSent(true);
    setLoading(false);
  };

  return (
    <section id="contacto" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-[#8B0000] text-sm font-semibold tracking-widest uppercase mb-4">
            <div className="h-px w-8 bg-[#C9A84C]" />
            Estamos aquí para ti
            <div className="h-px w-8 bg-[#C9A84C]" />
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Contáctanos
          </h2>
          <p className="text-gray-600 text-lg max-w-xl mx-auto leading-relaxed">
            Resuelve tus dudas, solicita información o inicia el proceso de
            matrícula. Nuestro equipo estará feliz de atenderte.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-10 items-start">
          {/* Contact info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Info cards */}
            {[
              {
                icon: MapPin,
                title: "Ubicación",
                lines: ["Soacha, Cundinamarca", "Colombia"],
              },
              {
                icon: Phone,
                title: "Teléfono",
                lines: ["+57 (1) 000-0000", "Lunes a viernes: 8am – 6pm"],
              },
              {
                icon: Mail,
                title: "Correo electrónico",
                lines: [
                  "info@harvardenterprise.edu.co",
                  "Respondemos en menos de 24h",
                ],
              },
            ].map(({ icon: Icon, title, lines }) => (
              <div
                key={title}
                className="flex gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#C9A84C]/30 transition-all duration-200"
              >
                <div className="w-11 h-11 bg-[#8B0000]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-[#8B0000]" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm mb-0.5">
                    {title}
                  </div>
                  {lines.map((l) => (
                    <div key={l} className="text-gray-500 text-sm">
                      {l}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Map placeholder */}
            <div className="rounded-2xl overflow-hidden h-48 bg-gradient-to-br from-gray-200 to-gray-300 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.pexels.com/photos/3935702/pexels-photo-3935702.jpeg?auto=compress&cs=tinysrgb&w=600"
                alt="Soacha, Cundinamarca"
                className="w-full h-full object-cover opacity-70"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-[#8B0000] text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-lg flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#C9A84C]" />
                  Soacha, Cundinamarca
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-3 bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            {sent ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="font-serif text-2xl font-bold text-gray-900 mb-2">
                  ¡Mensaje enviado!
                </h3>
                <p className="text-gray-500">
                  Gracias por contactarnos. Te responderemos pronto.
                </p>
                <button
                  onClick={() => {
                    setSent(false);
                    setForm({ nombre: "", telefono: "", correo: "", mensaje: "" });
                  }}
                  className="mt-6 text-[#8B0000] font-semibold hover:underline text-sm"
                >
                  Enviar otro mensaje
                </button>
              </div>
            ) : (
              <>
                <h3 className="font-serif text-2xl font-bold text-gray-900 mb-6">
                  Envíanos un mensaje
                </h3>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Nombre completo
                      </label>
                      <input
                        type="text"
                        name="nombre"
                        value={form.nombre}
                        onChange={handleChange}
                        required
                        placeholder="Tu nombre"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#8B0000] focus:ring-2 focus:ring-[#8B0000]/10 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        name="telefono"
                        value={form.telefono}
                        onChange={handleChange}
                        placeholder="+57 300 000 0000"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#8B0000] focus:ring-2 focus:ring-[#8B0000]/10 transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Correo electrónico
                    </label>
                    <input
                      type="email"
                      name="correo"
                      value={form.correo}
                      onChange={handleChange}
                      required
                      placeholder="tucorreo@ejemplo.com"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#8B0000] focus:ring-2 focus:ring-[#8B0000]/10 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Mensaje
                    </label>
                    <textarea
                      name="mensaje"
                      value={form.mensaje}
                      onChange={handleChange}
                      required
                      rows={4}
                      placeholder="Escribe tu consulta aquí..."
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#8B0000] focus:ring-2 focus:ring-[#8B0000]/10 transition-colors resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-[#8B0000] hover:bg-[#6b0000] disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-colors"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Enviar mensaje
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
