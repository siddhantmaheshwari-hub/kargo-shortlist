import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import { DecisionProvider } from "@/components/DecisionProvider";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kargo Shortlist",
  description: "Ranks PM and SPM candidates against the pattern Kargo's best hires share.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        <DecisionProvider>
          <div className="lg:flex">
            <Sidebar />
            <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:py-8 lg:pr-8 lg:pl-2">{children}</main>
          </div>
        </DecisionProvider>
      </body>
    </html>
  );
}
