import { CRITERIA, levelsFor } from "@/lib/rubric";
import type { Flag } from "@/lib/signals";
import type { Assessment, Band, EmailRow, Role } from "@/lib/types";

export const BAND_STYLE: Record<Band, { chip: string; tile: string; dot: string; ring: string }> = {
  Shortlist: { chip: "bg-good-bg text-good", tile: "bg-good-bg", dot: "bg-good", ring: "#65a30d" },
  "Second look": { chip: "bg-warn-bg text-warn", tile: "bg-warn-bg", dot: "bg-warn", ring: "#d97706" },
  Decline: { chip: "bg-bad-bg text-bad", tile: "bg-bad-bg", dot: "bg-bad", ring: "#e11d48" },
};

export function BandChip({ band, size = "sm" }: { band: Band | null; size?: "sm" | "md" }) {
  if (!band) return <span className="text-xs text-muted">Scoring…</span>;
  const pad = size === "md" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ${pad} ${BAND_STYLE[band].chip}`}>
      <span className={`size-1.5 rounded-full ${BAND_STYLE[band].dot}`} />
      {band}
    </span>
  );
}

/** Circular 0-100 score. */
export function ScoreRing({ score, band, size = 64 }: { score: number | null; band: Band | null; size?: number }) {
  const s = score ?? 0;
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const color = band ? BAND_STYLE[band].ring : "#8a9694";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Score ${s} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - s / 100)}
        />
      </svg>
      <span className="tabular absolute inset-0 flex items-center justify-center font-display text-lg font-medium">{score ?? "–"}</span>
    </div>
  );
}

const AVATAR_TINTS = ["#dff0e9", "#dde9f3", "#f1e6ef", "#f3ecdc", "#e4e6f5", "#e6f0dc"];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-display font-medium text-ink-2"
      style={{ width: size, height: size, background: AVATAR_TINTS[h % AVATAR_TINTS.length], fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}

/** Four compact bars, one per criterion (0–3), with "?" for unclear. */
export function CriterionBars({ assessment, role }: { assessment: Assessment | null; role: Role }) {
  if (!assessment) return null;
  const levels = levelsFor(assessment, role);
  return (
    <span className="inline-flex items-end gap-1.5" aria-label={CRITERIA.map(({ key }) => `${key} ${levels[key]} of 3`).join(", ")}>
      {CRITERIA.map(({ key, short }) => {
        const l = levels[key];
        const unclear = assessment.criteria[key].unclear;
        return (
          <span key={key} title={`${short}: ${l}/3${unclear ? " (unclear)" : ""}`} className="flex flex-col items-center gap-0.5">
            <span className="flex h-4 w-2.5 flex-col-reverse gap-px overflow-hidden rounded-[3px]">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`flex-1 ${i <= l ? (l === 3 ? "bg-accent" : unclear ? "bg-warn/60" : "bg-ink-2/70") : "bg-line"}`}
                />
              ))}
            </span>
            <span className={`text-[10px] leading-none ${unclear ? "text-warn" : "text-faint"}`}>
              {key}
              {unclear ? "?" : ""}
            </span>
          </span>
        );
      })}
    </span>
  );
}

const FLAG_TONE: Record<Flag["tone"], string> = {
  bad: "bg-bad-bg text-bad",
  warn: "bg-warn-bg text-warn",
  info: "bg-info-bg text-info",
  good: "bg-good-bg text-good",
};

export function FlagPill({ flag }: { flag: Flag }) {
  return (
    <span title={flag.detail} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${FLAG_TONE[flag.tone]}`}>
      {flag.label}
    </span>
  );
}

export function EmailStatus({ status }: { status: EmailRow["status"] | null }) {
  if (!status) return null;
  const map = { draft: "Draft saved", sent: "Sent", failed: "Failed" } as const;
  const tone = status === "sent" ? "bg-good-bg text-good" : status === "failed" ? "bg-bad-bg text-bad" : "bg-warn-bg text-warn";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{map[status]}</span>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`card p-5 sm:p-6 ${className}`}>{children}</section>;
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-sm text-accent">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function SetupNotice({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <Card className="max-w-2xl">
      <h2 className="font-display text-lg font-medium">Setup needed</h2>
      <p className="mt-2 text-sm text-muted">{msg}</p>
      <p className="mt-2 text-sm text-muted">
        Check <code>.env</code> against <code>.env.example</code>, and run <code>supabase/schema.sql</code> in the Supabase SQL editor.
      </p>
    </Card>
  );
}
