import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EMS Calculator - Dimensionamento Energetico",
  description:
    "Simulatore per il dimensionamento energetico ed economico di interventi fotovoltaici, storage e efficientamento energetico C&I e B2G",
  keywords: [
    "fotovoltaico",
    "storage",
    "batteria",
    "BESS",
    "autoconsumo",
    "efficienza energetica",
    "NPV",
    "IRR",
    "payback",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
