import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { CandidateProfile } from "@/components/CandidateProfile";
import { Card, EmailStatus, SetupNotice } from "@/components/ui";
import { getCandidate } from "@/lib/data";

export default async function CandidatePage(props: PageProps<"/candidates/[id]">) {
  const { id } = await props.params;
  let data: Awaited<ReturnType<typeof getCandidate>>;
  try {
    data = await getCandidate(id);
  } catch (e) {
    return <SetupNotice error={e} />;
  }
  if (!data) notFound();
  const { candidate: c, email, rank, listSize, hires } = data;
  const role = c.list_role ?? c.role_applied;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link href={`/roles/${role.toLowerCase()}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Back to {role === "PM" ? "Product Manager" : "Senior PM"} candidates
      </Link>

      {c.status !== "scored" ? (
        <Card className="max-w-2xl">
          <h1 className="font-display text-2xl font-medium">{c.name}</h1>
          <p className="mt-2 text-sm">{c.status === "error" ? <span className="text-bad">{c.error}</span> : "Scoring…"}</p>
          <div className="mt-4">
            <ActionButton url={`/api/candidates/${c.id}/rescore`} label="Try scoring again" busyLabel="Scoring…" />
          </div>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <CandidateProfile c={{ ...c, email_status: email?.status ?? null }} hires={hires} rank={rank} listSize={listSize} variant="page" />

          <div className="space-y-4">
            <div className="card p-5 sm:p-6">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-medium">
                  {email ? (email.kind === "invite" ? "Interview invite" : "Rejection email") : "Follow-up email"}
                </h3>
                <EmailStatus status={email?.status ?? null} />
              </div>
              {email ? (
                <>
                  <p className="text-xs text-muted">
                    To {email.to_email ?? "no address found on CV"}
                    {email.error && ` · ${email.error}`}
                  </p>
                  <p className="mt-3 text-sm font-medium">{email.subject}</p>
                  <pre className="mt-2 font-sans text-sm leading-relaxed whitespace-pre-wrap text-ink-2">{email.body}</pre>
                </>
              ) : (
                <p className="text-sm text-muted">
                  Written for you when you choose Advance to interview (an invite) or Reject (a respectful rejection). You review it before it&apos;s sent, and it never mentions scores.
                </p>
              )}
            </div>

            <details className="card group p-5 sm:p-6">
              <summary className="cursor-pointer list-none font-display text-base font-medium">
                Full CV text <span className="text-sm font-normal text-faint group-open:hidden">· show</span>
              </summary>
              <pre className="mt-3 max-h-[60vh] overflow-y-auto font-sans text-sm leading-relaxed whitespace-pre-wrap text-muted">{c.cv_text}</pre>
            </details>

            {!c.decision && (
              <div className="px-1">
                <ActionButton
                  url={`/api/candidates/${c.id}/rescore`}
                  label="Re-score this CV"
                  busyLabel="Scoring…"
                  confirm="Re-run the rubric and brief for this candidate?"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
