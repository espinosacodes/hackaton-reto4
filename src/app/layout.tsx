import type { Metadata } from "next";
import { Libre_Baskerville, Inter, Source_Code_Pro } from "next/font/google";
import "./globals.css";

const serif = Libre_Baskerville({
  variable: "--font-serif",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = Source_Code_Pro({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Centinela — Compliance Laboral · Hurtado Gandini",
  description:
    "Compliance laboral proactivo y gestión asistida de procesos disciplinarios. Lectura contractual, verificación de liquidaciones y detección de riesgo de reclasificación (Ley 2466/2025).",
  icons: {
    icon: [
      { url: "/favicon-hg-32.webp", sizes: "32x32", type: "image/webp" },
      { url: "/favicon-hg-192.webp", sizes: "192x192", type: "image/webp" },
    ],
    apple: [{ url: "/apple-icon-hg.webp" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${serif.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
