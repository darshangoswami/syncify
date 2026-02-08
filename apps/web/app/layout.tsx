import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";
import { Manrope, Outfit } from "next/font/google";
import "@/app/globals.css";

const display = Outfit({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display"
});

const body = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "Spotify XYZ Invite",
  description: "Private beta transfer app: request invite and get approved before OAuth."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>): ReactElement {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
