"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, LayoutGrid, Sparkles, Upload, Users } from "lucide-react";

const NAV = [
  { href: "/", label: "Today", icon: LayoutGrid, match: (p: string) => p === "/" },
  { href: "/roles/pm", label: "Candidates", icon: Users, match: (p: string) => p.startsWith("/roles") || p.startsWith("/candidates") },
  { href: "/upload", label: "Add CVs", icon: Upload, match: (p: string) => p.startsWith("/upload") },
  { href: "/pattern", label: "Success pattern", icon: Sparkles, match: (p: string) => p.startsWith("/pattern") },
  { href: "/outbox", label: "Outbox", icon: Inbox, match: (p: string) => p.startsWith("/outbox") },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-xl bg-ink text-white">
        <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden>
          <path d="M3 3h4v6.2L12.6 3H17l-6 6.6L17.4 17H12.8L7 10.4V17H3z" />
        </svg>
      </span>
      <span className="font-display text-lg font-medium tracking-tight">
        Kargo <span className="text-faint">Shortlist</span>
      </span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 px-5 py-6 lg:flex">
        <Logo />
        <nav className="flex flex-col gap-1" aria-label="Main">
          <p className="px-3 pb-2 text-xs font-medium text-faint">Menu</p>
          {NAV.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-11 items-center gap-3 rounded-full pr-4 pl-1.5 text-sm transition ${
                  active ? "bg-ink text-white" : "text-ink-2 hover:bg-white/70"
                }`}
              >
                <span
                  className={`flex size-8 items-center justify-center rounded-full ${active ? "bg-white/15" : "bg-white/80 ring-1 ring-line"}`}
                >
                  <Icon className="size-4" />
                </span>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="card mt-auto flex items-center gap-3 p-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft font-display text-sm font-medium text-accent">
            AM
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-medium">Arjun Mehta</p>
            <p className="truncate text-xs text-muted">Founder · Hiring manager</p>
          </div>
        </div>
      </aside>

      {/* Mobile / tablet */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface-solid/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Main">
          {NAV.map(({ href, label, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-full px-3.5 py-2 text-sm ${active ? "bg-ink text-white" : "text-ink-2"}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
