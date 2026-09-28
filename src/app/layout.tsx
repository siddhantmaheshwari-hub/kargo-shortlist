import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kargo Shortlist",
  description: "Ranks PM and SPM candidates against the pattern Kargo's best hires share.",
};

const NAV = [
  { href: "/roles/pm", label: "Product Manager" },
  { href: "/roles/spm", label: "Senior PM" },
  { href: "/upload", label: "Add CVs" },
  { href: "/pattern", label: "Success pattern" },
  { href: "/outbox", label: "Outbox" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              Kargo <span className="text-muted font-normal">Shortlist</span>
            </Link>
            <nav className="flex flex-wrap gap-4 text-sm text-muted">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-ink">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
