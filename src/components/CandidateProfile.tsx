import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Check, CircleHelp, Mail, MapPin, Minus, X } from "lucide-react";
import { Avatar, BandChip, FlagPill, ScoreRing } from "./ui";
import { DecisionBar, type DecisionTarget } from "./DecisionBar";
import { closestHire } from "@/lib/rubric";
import { locationCheck, mustHaves, redFlags, tags, type MustHaveStatus } from "@/lib/signals";
import type { Assessment, Band, Brief, Override, Role } from "@/lib/types";

export interface ProfileCandidate extends Omit<DecisionTarget, "role"> {
  role_applied: Role;
  list_role: Role | null;
  location: string | null;
  total: number | null;
  pm_total: number | null;
  spm_total: number | null;
  overrides: Override[];
  flagged_spm: boolean;
  unclear_count: number;
  brief: Brief | null;
  band: Band | null;
}

export interface HireLite {
  name: string;
  rating: string;
  thriving: boolean;
  assessment: Assessment | null;
}

const STATUS_ICON: Record<MustHaveStatus, { icon: typeof Check; cls: string; label: string }> = {
  strong: { icon: Check, cls: "bg-good-bg text-good", label: "Strong" },
  partial: { icon: Check, cls: "bg-info-bg text-info", label: "Partial" },
  weak: { icon: Minus, cls: "bg-sunk text-muted", label: "Weak" },
  missing: { icon: X, cls: "bg-bad-bg text-bad", label: "Not shown" },
  unclear: { icon: CircleHelp, cls: "bg-warn-bg text-warn", label: "Unclear" },
};

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h3 className="font-display text-base font-medium">{children}</h3>
      {aside && <span className="text-xs text-faint">{aside}</span>}
    </div>
  );
}

export function CandidateProfile({
  c,
  hires,
  rank,
  listSize,
  variant = "panel",
}: {
  c: ProfileCandidate;
  hires: HireLite[];
  rank?: number | null;
  listSize?: number;
  variant?: "panel" | "page";
}) {
  const role = c.list_role ?? c.role_applied;
  const a = c.assessment;
  const checks = a ? mustHaves(a, role) : [];
  const loc = a ? locationCheck(a) : null;
  const flags = a ? redFlags({ assessment: a, role, email: c.email, unclearCount: c.unclear_count }) : [];
  const tagList = tags({ overrides: c.overrides, flaggedSpm: c.flagged_spm, roleApplied: c.role_applied, listRole: c.list_role, spmTotal: c.spm_total });
  const twin = a ? closestHire(a, hires) : null;
  const NameTag = variant === "page" ? "h1" : "h2";
  const warnings = [...(loc && loc.tone !== "good" ? [loc] : []), ...flags];

  return (
    <article className="space-y-4">
      {/* Identity hero: CV-style, calm gradient, no stock photo */}
      <div className="card overflow-hidden p-0">
        <div className="h-20 bg-[linear-gradient(110deg,#cfe8e2_0%,#dde6f0_55%,#efdfe6_100%)]" />
        <div className="-mt-10 px-5 pb-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="rounded-full bg-surface-solid p-1">
              <Avatar name={c.name} size={72} />
            </div>
            <ScoreRing score={c.total} band={c.band} size={68} />
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <NameTag className="font-display text-2xl font-medium tracking-tight">{c.name}</NameTag>
              <BandChip band={c.band} />
            </div>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span>
                Applied for {c.role_applied === "PM" ? "Product Manager" : "Senior PM"}
                {rank ? ` · #${rank} of ${listSize} on ${role}` : ""}
              </span>
              {c.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" /> {c.location}
                </span>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-ink">
                  <Mail className="size-3.5" /> {c.email}
                </a>
              )}
            </p>
            <p className="tabular text-xs text-faint">
              PM rubric {c.pm_total ?? "–"} · SPM rubric {c.spm_total ?? "–"}
            </p>
            {tagList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tagList.map((t) => (
                  <FlagPill key={t.label} flag={t} />
                ))}
              </div>
            )}
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <DecisionBar c={{ ...c, role }} showKeys={variant === "panel"} />
          </div>
        </div>
      </div>

      {c.brief && (
        <div className="card space-y-4 p-5 sm:p-6">
          <div>
            <SectionTitle>Why they&apos;re ranked here</SectionTitle>
            <p className="leading-relaxed text-ink-2">{c.brief.whyRanked}</p>
          </div>
          <div className="border-t border-line pt-4">
            <SectionTitle>Who they are</SectionTitle>
            <p className="leading-relaxed text-muted">{c.brief.who}</p>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="card p-5 sm:p-6">
          <SectionTitle>Check before deciding</SectionTitle>
          <ul className="space-y-2.5">
            {warnings.map((f) => (
              <li key={f.label} className="flex gap-3">
                <span
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${f.tone === "bad" ? "bg-bad-bg text-bad" : "bg-warn-bg text-warn"}`}
                >
                  <AlertTriangle className="size-3.5" />
                </span>
                <div className="text-sm">
                  <p className="font-medium">{f.label}</p>
                  <p className="text-muted">{f.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {checks.length > 0 && (
        <div className="card p-5 sm:p-6">
          <SectionTitle aside="Titles, years and degrees are not scored">What Kargo&apos;s best hires share</SectionTitle>
          <ul className="divide-y divide-line">
            {checks.map((m) => {
              const s = STATUS_ICON[m.status];
              const Icon = s.icon;
              return (
                <li key={m.key} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${s.cls}`}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="font-medium">{m.name}</p>
                      <span className="tabular text-xs text-faint">
                        {s.label} · {m.level}/3
                      </span>
                    </div>
                    <p className="text-sm text-muted">{m.reason}</p>
                    {m.evidence && (
                      <blockquote className="mt-1.5 border-l-2 border-accent/40 pl-3 text-sm text-ink-2">&ldquo;{m.evidence}&rdquo;</blockquote>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {loc && loc.tone === "good" && (
            <p className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-sm text-muted">
              <Check className="size-4 text-good" /> Location: {loc.label}
            </p>
          )}
        </div>
      )}

      {c.brief && c.brief.probes.length > 0 && (
        <div className="card p-5 sm:p-6">
          <SectionTitle>Ask in the interview</SectionTitle>
          <ol className="space-y-3">
            {c.brief.probes.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="tabular mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-sunk text-xs text-muted">{i + 1}</span>
                <div className="text-sm">
                  <p className="font-medium text-ink">&ldquo;{p.question}&rdquo;</p>
                  <p className="text-muted">{p.why}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {twin && (
        <div className="card flex items-center gap-3 p-4">
          <Avatar name={twin.hire.name} size={36} />
          <p className="text-sm text-muted">
            Closest past-hire profile: <span className="font-medium text-ink">{twin.hire.name}</span> · {twin.hire.rating}
            {twin.hire.thriving ? ", still thriving" : ""}
          </p>
        </div>
      )}

      {variant === "panel" && (
        <Link href={`/candidates/${c.id}`} className="inline-flex items-center gap-1 px-1 text-sm text-accent hover:underline">
          Full profile, CV text and email <ArrowUpRight className="size-3.5" />
        </Link>
      )}
    </article>
  );
}
