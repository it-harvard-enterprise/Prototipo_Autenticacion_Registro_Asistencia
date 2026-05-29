import type { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import About from "@/components/landing/About";
import Program from "@/components/landing/Program";
import Levels from "@/components/landing/Levels";
import HowItWorks from "@/components/landing/HowItWorks";
import EduControl from "@/components/landing/EduControl";
import Benefits from "@/components/landing/Benefits";
import Contact from "@/components/landing/Contact";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Harvard Enterprise S.A.S. | Formación Académica Bilingüe",
  description:
    "Institución educativa en Soacha con más de 20 años de trayectoria. Programa País Bilingüe con énfasis en inglés, matemáticas y sistemas para niños y jóvenes.",
};

export default function RootPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <About />
      <Program />
      <Levels />
      <HowItWorks />
      <EduControl />
      <Benefits />
      <Contact />
      <Footer />
    </div>
  );
}
