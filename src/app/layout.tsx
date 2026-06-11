import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "NOLA Lead Intelligence",
  description:
    "Identify, rank, and visualize AI-automation prospects across the Greater New Orleans metro.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Nav />
        <main className="mx-auto max-w-[1700px]">{children}</main>
      </body>
    </html>
  );
}
