import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { DecisionButtons } from "@/components/DecisionButtons";
import { BandBadge, Card, EmailStatus, OverrideTags, SetupNotice } from "@/components/ui";
import { getCandidate, pastHires } from "@/lib/data";
import { CRITERIA, WEIGHTS, closestHire, levelsFor } from "@/lib/rubric";

const RELOCATION_LABEL = {
  mumbai: "Mumbai-based",
  willing: "Willing to relocate",
  unknown: "Relocation not stated",
  not_willing: "Not willing to relocate",
} as const;

export default async function CandidatePage(props: PageProps<"/candidates/[id]">) {
  const { id } = await props.params;
  let data: Awaited<ReturnType<typeof getCandidate>>;
  let hires: Awaited<ReturnType<typeof pastHires>> = [];
  try {
    data = await getCandidate(id);
    hires = await pastHires();
  } catch (e) {
    return <SetupNotice error={e} />;
  }
  if (!data) notFound();
  const { candidate: c, email, rank, listSize } = data;
  const role = c.list_role ?? c.role_applied;
  const a = c.assessment;
  const levels = a ? levelsFor(a, role) : null;
  const twin = a ? closestHire(a, hires) : null;

  return (
    <div className="space-y-6">
      <Link href={`/roles/${role.toLowerCase()}`} className="text-sm text-muted hover:text-ink">
        ← {role === "PM" ? "Product Manager" : "Senior Product Manager"} list
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <BandBadge band={c.band} />
            {c.total !== null && <span className="font-mono">{c.total}/100</span>}
            {rank && (
              <span className="text-muted">
                #{rank} of {listSize} on {role}
              </span>
            )}
            <OverrideTags overrides={c.overrides} flaggedSpm={c.flagged_spm} />
          </div>
          <p className="text-sm text-muted">
            Applied for {c.role_applied}
            {c.role_applied !== role && ` · moved to the ${role} list by the cross-route rule`}
            {" · "}PM rubric {c.pm_total ?? "–"} · SPM rubric {c.spm_total ?? "–"}
            {c.relocation && ` · ${c.location ? `${c.location}, ` : ""}${RELOCATION_LABEL[c.relocation]}`}
          </p>
        </div>
        {c.status === "scored" && (
          <DecisionButtons candidateId={c.id} decision={c.decision} emailStatus={email?.status ?? null} />
        )}
      </div>

      {c.status !== "scored" && (
        <Card>
          <p className="text-sm">{c.status === "error" ? <span className="text-bad">{c.error}</span> : "Scoring…"}</p>
          <div className="mt-3">
            <ActionButton url={`/api/candidates/${c.id}/rescore`} label="Try scoring again" busyLabel="Scoring…" />
          </div>
        </Card>
      )}

      {c.brief && (
        <Card className="space-y-5">
          <div>
            <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Who they are</h2>
            <p className="mt-1">{c.brief.who}</p>
          </div>
          <div>
            <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Why they&apos;re ranked here</h2>
            <p className="mt-1">{c.brief.whyRanked}</p>
          </div>
          <div>
            <h2 className="text-xs font-medium tracking-wide text-muted uppercase">What to probe in the interview</h2>
            <ul className="mt-2 space-y-3">
              {c.brief.probes.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-6 shrink-0 font-mono text-xs text-muted">{p.criterion === "Location" ? "📍" : p.criterion}</span>
                  <div>
                    <p className="font-medium">&ldquo;{p.question}&rdquo;</p>
                    <p className="text-sm text-muted">{p.why}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          {twin && (
            <p className="border-t border-line pt-4 text-sm text-muted">
              Closest past-hire profile: <span className="text-ink">{twin.hire.name}</span> ({twin.hire.rating}
              {twin.hire.thriving ? ", thriving" : ""})
            </p>
          )}
        </Card>
      )}

      {a && levels && (
        <Card>
          <h2 className="font-semibold">Scorecard ({role} rubric)</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3 font-medium">Criterion</th>
                  <th className="py-2 pr-3 font-medium">Weight</th>
                  <th className="py-2 pr-3 font-medium">Score</th>
                  <th className="py-2 font-medium">Evidence from the CV</th>
                </tr>
              </thead>
              <tbody>
                {CRITERIA.map(({ key, name }) => {
                  const cr = a.criteria[key];
                  return (
                    <tr key={key} className="border-b border-line align-top last:border-0">
                      <td className="py-3 pr-3">
                        <span className="font-mono text-muted">{key}</span> {name}
                      </td>
                      <td className="py-3 pr-3 font-mono">{WEIGHTS[role][key]}%</td>
                      <td className="py-3 pr-3 font-mono">
                        {levels[key]}/3{cr.unclear ? " ?" : ""}
                      </td>
                      <td className="py-3">
                        {cr.evidence ? <p>&ldquo;{cr.evidence}&rdquo;</p> : <p className="text-muted">Nothing in the CV</p>}
                        <p className="mt-1 text-xs text-muted">{cr.rationale}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            {c.unclear_count} unclear (?) · Scored with {a.model}. Totals, bands and overrides are computed in code from
            these levels.
          </p>
        </Card>
      )}

      {email && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{email.kind === "invite" ? "Interview invite" : "Rejection email"}</h2>
            <EmailStatus status={email.status} />
          </div>
          <p className="mt-1 text-xs text-muted">
            To: {email.to_email ?? "no address found on CV"}
            {email.error && ` · ${email.error}`}
          </p>
          <p className="mt-3 text-sm font-medium">{email.subject}</p>
          <pre className="mt-2 font-sans text-sm whitespace-pre-wrap">{email.body}</pre>
        </Card>
      )}

      <details className="rounded-lg border border-line bg-surface p-5">
        <summary className="cursor-pointer text-sm font-medium">Full CV text</summary>
        <pre className="mt-3 font-sans text-sm whitespace-pre-wrap text-muted">{c.cv_text}</pre>
        {c.status === "scored" && !c.decision && (
          <div className="mt-4">
            <ActionButton
              url={`/api/candidates/${c.id}/rescore`}
              label="Re-score this CV"
              busyLabel="Scoring…"
              confirm="Re-run the rubric and brief for this candidate?"
            />
          </div>
        )}
      </details>
    </div>
  );
}
