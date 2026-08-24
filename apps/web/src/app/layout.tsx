import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { authMode } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  title: "Student Platform",
  description: "Student development platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const body = (
    <html lang="en">
      <body className="antialiased bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
  return authMode() === "clerk" ? <ClerkProvider>{body}</ClerkProvider> : body;
}
