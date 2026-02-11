import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { CanonicalHostGuard } from "@/components/canonical-host-guard";
import "@/app/globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "syncify",
  description: "Transfer your music library between providers."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>): ReactElement {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons+Round"
          rel="stylesheet"
        />
      </head>
      <body className={`${plusJakarta.variable} font-sans bg-background-dark text-white antialiased`}>
        <CanonicalHostGuard />
        {children}
      </body>
    </html>
  );
}
