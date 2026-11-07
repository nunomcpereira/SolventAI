import type { ReactNode } from "react";
import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Serif, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";
import { getTheme } from "../lib/themeServer.js";

// next/font self-hosts these at build time — zero runtime requests to Google Fonts,
// consistent with the app's local-first / no-hidden-network-calls principle.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
});
const plexSerif = IBM_Plex_Serif({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-plex-serif",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

// The "original" theme keeps the pre-redesign typography.
const inter = Inter({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Solvent",
  description: "Local-first personal liquidity and debt simulation.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = await getTheme();
  return (
    <html lang="en" data-theme={theme} className={`${plexSans.variable} ${plexSerif.variable} ${plexMono.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
