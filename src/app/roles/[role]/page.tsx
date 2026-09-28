import Link from "next/link";
import { notFound } from "next/navigation";
import { DecisionButtons } from "@/components/DecisionButtons";
import { BandBadge, Card, LevelPips, OverrideTags, SetupNotice } from "@/components/ui";
import { rankedList, type ListCandidate } from "@/lib/data";
import { BANDS } from "@/lib/rubric";
import type { Role } from "@/lib/types";

const ROLES: Record<string, { role: Role; title: string }> = {
  pm: { role: "PM", title: "Product Manager" },
  spm: { role: "SPM", title: "Senior Product Manager" },
};

function Row({ c, rank, role }: { c: ListCandidate; rank: number | null; role: Role }) {
  return (
    <li className={`grid gap-3 px-4 py-4 md:grid-cols-[2.5rem_1fr_auto] md:items-start ${c.decision ? "opacity-70" : ""}`}>
      <span className="font-mono text-sm text-muted">{rank ?? "·"}</span>
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/candidates/${c.id}`} className="font-medium hover:underline">
            {c.name}
          </Link>
          <BandBadge band={c.band} />
          <span className="font-mono text-sm">{c.total}</span>
          <OverrideTags overrides={c.overrides} flaggedSpm={c.flagged_spm} />
          {c.role_applied !== role && <span className="text-xs text-muted">applied for {c.role_applied}</span>}
        </div>
        <LevelPips assessment={c.assessment} role={role} />
        {c.brief?.whyRanked && <p className="max-w-3xl text-sm text-muted">{c.brief.whyRanked}</p>}
      </div>
      <div className="md:pt-0.5">
        <DecisionButtons candidateId={c.id} decision={c.decision} emailStatus={c.email_status} compact />
      </div>
    </li>
  );
}

export default async function RolePage(props: PageProps<"/roles/[role]">) {
  const { role: slug } = await props.params;
  const meta = ROLES[slug];
  if (!meta) notFound();

  let data: Awaited<ReturnType<typeof rankedList>>;
  try {
    data = await rankedList(meta.role);
  } catch (e) {
    return <SetupNotice error={e} />;
  }
  const { ranked, flaggedFromPm, pending } = data;
  const undecided = ranked.filter((c) => !c.decision);
  const decided = ranked.filter((c) => c.decision);
  const b = BANDS[meta.role];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
          <p className="mt-1 text-sm text-muted">
            Shortlist ≥ {b.shortlist} · Second look {b.secondLook}–{b.shortlist - 1} · Decline &lt; {b.secondLook}. Ranked by
            band, then score. A B C D are the four criteria (0–3, ? = unclear).
          </p>
        </div>
        <Link href="/upload" className="rounded border border-line bg-surface px-3 py-1.5 text-sm hover:bg-bg">
          Add CVs
        </Link>
      </div>

      {ranked.length === 0 && pending.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">No candidates on this list yet.</p>
        </Card>
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-sm font-medium text-muted">To decide ({undecided.length})</h2>
            {undecided.length ? (
              <ol className="divide-y divide-line rounded-lg border border-line bg-surface">
                {undecided.map((c) => (
                  <Row key={c.id} c={c} rank={ranked.indexOf(c) + 1} role={meta.role} />
                ))}
              </ol>
            ) : (
              <Card>
                <p className="text-sm text-muted">Everyone on this list has a decision.</p>
              </Card>
            )}
          </section>

          {decided.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-muted">Decided ({decided.length})</h2>
              <ol className="divide-y divide-line rounded-lg border border-line bg-surface">
                {decided.map((c) => (
                  <Row key={c.id} c={c} rank={ranked.indexOf(c) + 1} role={meta.role} />
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      {flaggedFromPm.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-medium text-muted">PM applicants flagged for SPM ({flaggedFromPm.length})</h2>
          <p className="mb-2 text-xs text-muted">
            They applied for PM and are ranked on the PM list, but score 70+ on the SPM rubric.
          </p>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {flaggedFromPm.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <Link href={`/candidates/${c.id}`} className="font-medium hover:underline">
                  {c.name}
                </Link>
                <span className="font-mono">SPM {c.spm_total}</span>
                <span className="text-muted">PM {c.pm_total}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pending.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted">Not scored</h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
            {pending.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <Link href={`/candidates/${c.id}`} className="font-medium hover:underline">
                  {c.name}
                </Link>
                <span className={c.status === "error" ? "text-bad" : "text-muted"}>
                  {c.status === "error" ? c.error : "Scoring…"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
