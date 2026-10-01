import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Mail, Sparkles, Upload, X } from "lucide-react";
import { Avatar, BandChip, SetupNotice } from "@/components/ui";
import { overview, type ActivityItem, type RoleStats } from "@/lib/data";
import type { Role } from "@/lib/types";

const PORT_PHOTO = "https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3";

const ROLE_META: Record<Role, { slug: string; title: string }> = {
  PM: { slug: "pm", title: "Product Manager" },
  SPM: { slug: "spm", title: "Senior Product Manager" },
};

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const ACTIVITY_ICON: Record<ActivityItem["kind"], { icon: typeof Check; cls: string }> = {
  scored: { icon: Sparkles, cls: "bg-sunk text-ink-2" },
  advanced: { icon: Check, cls: "bg-good-bg text-good" },
  passed: { icon: X, cls: "bg-bad-bg text-bad" },
  sent: { icon: Mail, cls: "bg-info-bg text-info" },
  draft: { icon: Mail, cls: "bg-warn-bg text-warn" },
  failed: { icon: Mail, cls: "bg-bad-bg text-bad" },
};

function RoleCard({ role, s }: { role: Role; s: RoleStats }) {
  const meta = ROLE_META[role];
  const tiles = [
    { label: "Shortlist", value: s.shortlist, cls: "bg-good-bg text-good" },
    { label: "Second look", value: s.secondLook, cls: "bg-warn-bg text-warn" },
    { label: "Decline", value: s.decline, cls: "bg-bad-bg text-bad" },
  ];
  return (
    <div className="card flex flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-medium">{meta.title}</h2>
          <p className="text-sm text-muted">
            {s.total} scored · {s.advanced} invited · {s.rejected} rejected
          </p>
        </div>
        <Link
          href={`/roles/${meta.slug}`}
          aria-label={`Open ${meta.title} candidates`}
          className="flex size-10 items-center justify-center rounded-full border border-line bg-surface-solid hover:bg-sunk"
        >
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className={`rounded-2xl px-3 py-3 ${t.cls}`}>
            <p className="text-xs">{t.label}</p>
            <p className="tabular mt-3 font-display text-2xl font-medium">{t.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-1 items-end">
        {s.topUndecided ? (
          <Link
            href={`/roles/${meta.slug}`}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-solid p-3 transition hover:border-line-strong"
          >
            <Avatar name={s.topUndecided.name} size={36} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-faint">Next up · {s.undecided} waiting</p>
              <p className="truncate font-medium">{s.topUndecided.name}</p>
            </div>
            <span className="tabular font-display text-lg">{s.topUndecided.total}</span>
            <BandChip band={s.topUndecided.band} />
          </Link>
        ) : (
          <p className="text-sm text-muted">{s.total ? "Nothing waiting on you." : "No candidates yet."}</p>
        )}
      </div>
    </div>
  );
}

export default async function Today() {
  let data: Awaited<ReturnType<typeof overview>>;
  try {
    data = await overview();
  } catch (e) {
    return <SetupNotice error={e} />;
  }
  const { stats, activity, calibrated } = data;
  const waiting = stats.PM.undecided + stats.SPM.undecided;
  const busiest: Role = stats.SPM.undecided > stats.PM.undecided ? "SPM" : "PM";
  const empty = stats.PM.total + stats.SPM.total === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-accent">{greeting()}, Arjun</p>
          <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
            {empty ? "Let's build your shortlist" : waiting ? `${waiting} candidate${waiting === 1 ? "" : "s"} need a decision` : "You're all caught up"}
          </h1>
        </div>
        {empty ? (
          <Link href="/upload" className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink-2">
            <Upload className="size-4" /> Add CVs
          </Link>
        ) : (
          waiting > 0 && (
            <Link
              href={`/roles/${ROLE_META[busiest].slug}`}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink-2"
            >
              Start reviewing <ArrowRight className="size-4" />
            </Link>
          )
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <RoleCard role="PM" s={stats.PM} />
            <RoleCard role="SPM" s={stats.SPM} />
          </div>

          <Link href="/pattern" className="group relative block overflow-hidden rounded-[1.5rem]">
            <Image
              src={PORT_PHOTO}
              alt="Container port seen from above"
              width={1400}
              height={600}
              sizes="(min-width: 1280px) 60vw, 100vw"
              className="h-56 w-full object-cover transition duration-500 group-hover:scale-[1.02]"
              priority
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(10_40_38/0.82)_0%,rgb(10_40_38/0.45)_55%,transparent_100%)]" />
            <div className="absolute inset-0 flex flex-col justify-end p-6 text-white">
              <p className="text-xs tracking-wide text-white/70 uppercase">The pattern behind the ranking</p>
              <p className="mt-1 max-w-md font-display text-2xl leading-snug font-medium">
                4 of Kargo&apos;s 5 strongest hires never held a PM title.
              </p>
              <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-ink">
                {calibrated ? "See what they share" : "Run calibration"} <ArrowRight className="size-4" />
              </span>
            </div>
          </Link>
        </div>

        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-medium">Recent activity</h2>
            <Link href="/outbox" className="text-sm text-accent hover:underline">
              Outbox
            </Link>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-muted">Scores, decisions and sent emails will appear here.</p>
          ) : (
            <ol className="space-y-1">
              {activity.map((a, i) => {
                const { icon: Icon, cls } = ACTIVITY_ICON[a.kind];
                return (
                  <li key={i}>
                    <Link href={`/candidates/${a.candidateId}`} className="flex items-start gap-3 rounded-2xl p-2 hover:bg-white/70">
                      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${cls}`}>
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="truncate font-medium">{a.name}</p>
                        <p className="truncate text-muted">{a.detail}</p>
                      </div>
                      <span className="shrink-0 text-xs text-faint">{ago(a.at)}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
