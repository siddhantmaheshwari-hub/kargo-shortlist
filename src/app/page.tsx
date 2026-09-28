import Link from "next/link";
import { Card, SetupNotice } from "@/components/ui";
import { overview } from "@/lib/data";
import { CRITERIA } from "@/lib/rubric";

const ROLES = [
  { role: "PM" as const, slug: "pm", title: "Product Manager" },
  { role: "SPM" as const, slug: "spm", title: "Senior Product Manager" },
];

export default async function Home() {
  let stats: Awaited<ReturnType<typeof overview>>;
  try {
    stats = await overview();
  } catch (e) {
    return <SetupNotice error={e} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Open roles</h1>
        <p className="mt-1 text-sm text-muted">
          Candidates are ranked by how closely they match what Kargo&apos;s best hires have in common, not by how well
          they match the JD.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {ROLES.map(({ role, slug, title }) => {
          const s = stats[role];
          return (
            <Link key={role} href={`/roles/${slug}`} className="block">
              <Card className="h-full transition hover:border-ink/30">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold">{title}</h2>
                  <span className="text-sm text-muted">{s.total} scored</span>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded bg-good-bg py-2">
                    <dt className="text-xs text-good">Shortlist</dt>
                    <dd className="text-xl font-semibold text-good">{s.shortlist}</dd>
                  </div>
                  <div className="rounded bg-warn-bg py-2">
                    <dt className="text-xs text-warn">Second look</dt>
                    <dd className="text-xl font-semibold text-warn">{s.secondLook}</dd>
                  </div>
                  <div className="rounded bg-bad-bg py-2">
                    <dt className="text-xs text-bad">Decline</dt>
                    <dd className="text-xl font-semibold text-bad">{s.decline}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-sm">
                  {s.undecided > 0 ? (
                    <>
                      <span className="font-medium">{s.undecided}</span> waiting for Advance or Pass
                    </>
                  ) : (
                    <span className="text-muted">Nothing waiting on you</span>
                  )}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <h2 className="font-semibold">What the ranking looks for</h2>
        <p className="mt-1 text-sm text-muted">
          Four of Kargo&apos;s five strongest hires never held a PM title. What they share is behaviour:
        </p>
        <ol className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          {CRITERIA.map((c) => (
            <li key={c.key} className="flex gap-2">
              <span className="font-mono text-muted">{c.key}</span>
              {c.name}
            </li>
          ))}
        </ol>
        <Link href="/pattern" className="mt-4 inline-block text-sm text-accent underline">
          See how this was learned from past hires
        </Link>
      </Card>

      {stats.PM.total + stats.SPM.total === 0 && (
        <Card>
          <p className="text-sm">
            No candidates yet.{" "}
            <Link href="/upload" className="text-accent underline">
              Add CVs
            </Link>{" "}
            to get a ranked shortlist.
          </p>
        </Card>
      )}
    </div>
  );
}
