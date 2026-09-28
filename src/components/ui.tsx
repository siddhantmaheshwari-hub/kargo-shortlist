import { CRITERIA, levelsFor } from "@/lib/rubric";
import type { Assessment, Band, EmailRow, Override, Role } from "@/lib/types";

const BAND_STYLE: Record<Band, string> = {
  Shortlist: "bg-good-bg text-good",
  "Second look": "bg-warn-bg text-warn",
  Decline: "bg-bad-bg text-bad",
};

export function BandBadge({ band }: { band: Band | null }) {
  if (!band) return <span className="text-xs text-muted">Scoring…</span>;
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${BAND_STYLE[band]}`}>{band}</span>;
}

const OVERRIDE_HELP: Record<Override, string> = {
  Spike: "A 3 on ops exposure or unprompted fix guarantees a second look",
  Unclear: "Two or more unclear (?) scores guarantee a second look",
  "Cross-route": "Moved between PM and SPM lists by the cross-route rule",
  Knockout: "CV says they won't be Mumbai-based or relocate",
};

export function OverrideTags({ overrides, flaggedSpm }: { overrides: Override[]; flaggedSpm?: boolean }) {
  const tags = overrides.filter((o) => !(o === "Cross-route" && flaggedSpm));
  return (
    <span className="inline-flex flex-wrap gap-1">
      {tags.map((o) => (
        <span key={o} title={OVERRIDE_HELP[o]} className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted">
          {o}
        </span>
      ))}
      {flaggedSpm && (
        <span title="Scores 70+ on the SPM rubric" className="rounded border border-accent/40 px-1.5 py-0.5 text-[11px] text-accent">
          Consider for SPM
        </span>
      )}
    </span>
  );
}

/** Four small cells, one per criterion, showing the 0-3 level (and "?" when unclear). */
export function LevelPips({ assessment, role }: { assessment: Assessment | null; role: Role }) {
  if (!assessment) return null;
  const levels = levelsFor(assessment, role);
  return (
    <span className="inline-flex gap-1 font-mono text-xs">
      {CRITERIA.map(({ key, short }) => {
        const l = levels[key];
        const unclear = assessment.criteria[key].unclear;
        const tone = l === 3 ? "bg-good-bg text-good" : l === 2 ? "bg-surface text-ink" : "bg-bg text-muted";
        return (
          <span key={key} title={`${short}: ${l}/3${unclear ? " (unclear)" : ""}`} className={`w-9 rounded border border-line py-0.5 text-center ${tone}`}>
            {key}
            {l}
            {unclear ? "?" : ""}
          </span>
        );
      })}
    </span>
  );
}

export function EmailStatus({ status }: { status: EmailRow["status"] | null }) {
  if (!status) return null;
  const map = { draft: "Email saved as draft", sent: "Email sent", failed: "Email failed" } as const;
  const tone = status === "sent" ? "text-good" : status === "failed" ? "text-bad" : "text-warn";
  return <span className={`text-xs ${tone}`}>{map[status]}</span>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-line bg-surface p-5 ${className}`}>{children}</section>;
}

export function SetupNotice({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <Card className="border-warn/40">
      <h2 className="font-semibold">Setup needed</h2>
      <p className="mt-2 text-sm text-muted">{msg}</p>
      <p className="mt-2 text-sm text-muted">
        Check <code>.env</code> against <code>.env.example</code>, and run <code>supabase/schema.sql</code> in the Supabase SQL editor.
      </p>
    </Card>
  );
}
