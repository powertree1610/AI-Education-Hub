import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Baloo_2, Figtree } from "next/font/google";
import { authMode } from "@/lib/env";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const baloo = Baloo_2({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-baloo" });

export const metadata: Metadata = {
  title: "Student Platform",
  description: "Student development platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const body = (
    <html lang="en" className={`${figtree.variable} ${baloo.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
  return authMode() === "clerk" ? <ClerkProvider>{body}</ClerkProvider> : body;
}
