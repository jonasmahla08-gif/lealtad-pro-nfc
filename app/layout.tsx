import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Lealtad Pro NFC",
  description: "Sistema de tarjetas de lealtad NFC para negocios locales",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-50 font-sans">
        {children}
        {/* Toaster global — Fase 3 lo usará para éxito/error */}
        <Toaster
          position="top-center"
          richColors
          closeButton
          duration={4000}
        />
      </body>
    </html>
  );
}
