import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SysAsistencia - HE",
  description: "Sistema de autenticación y registro de asistencia",
  icons: {
    icon: [
      { url: "/fav_icons/favicon.ico" },
      {
        url: "/fav_icons/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: "/fav_icons/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/fav_icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  manifest: "/fav_icons/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script
          src="/websdk.client.bundle.min.js"
          strategy="afterInteractive"
        />
        <Script src="/websdk.compat.js" strategy="afterInteractive" />
        <Script src="/dp.core.bundle.js" strategy="afterInteractive" />
        <Script src="/dp.devices.bundle.js" strategy="afterInteractive" />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
