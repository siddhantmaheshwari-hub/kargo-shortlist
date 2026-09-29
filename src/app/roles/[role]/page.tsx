import Link from "next/link";
import { notFound } from "next/navigation";
import { Upload } from "lucide-react";
import { PageHeader, SetupNotice } from "@/components/ui";
import { Workspace } from "@/components/Workspace";
import { workspace } from "@/lib/data";
import { BANDS } from "@/lib/rubric";
import type { Role } from "@/lib/types";

const ROLES: Record<string, { role: Role; title: string }> = {
  pm: { role: "PM", title: "Product Manager" },
  spm: { role: "SPM", title: "Senior Product Manager" },
};

export default async function RolePage(props: PageProps<"/roles/[role]">) {
  const { role: slug } = await props.params;
  const meta = ROLES[slug];
  if (!meta) notFound();

  let data: Awaited<ReturnType<typeof workspace>>;
  try {
    data = await workspace(meta.role);
  } catch (e) {
    return <SetupNotice error={e} />;
  }
  const b = BANDS[meta.role];
  const undecided = data.ranked.filter((c) => !c.decision).length;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={`${undecided} waiting for a decision`} title="Candidates">
        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex rounded-full bg-white/70 p-1 ring-1 ring-line" aria-label="Role">
            {Object.entries(ROLES).map(([s, r]) => (
              <Link
                key={s}
                href={`/roles/${s}`}
                aria-current={s === slug ? "page" : undefined}
                className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm transition ${
                  s === slug ? "bg-ink text-white" : "text-ink-2 hover:text-ink"
                }`}
              >
                {r.title}
                {s !== slug && data.otherRoleUndecided > 0 && (
                  <span className="tabular rounded-full bg-accent-soft px-1.5 text-xs text-accent">{data.otherRoleUndecided}</span>
                )}
              </Link>
            ))}
          </nav>
          <Link href="/upload" className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface-solid px-4 text-sm hover:bg-sunk">
            <Upload className="size-4" /> Add CVs
          </Link>
        </div>
      </PageHeader>

      <p className="text-sm text-muted">
        Shortlist ≥ {b.shortlist} · Second look {b.secondLook}–{b.shortlist - 1} · Decline &lt; {b.secondLook}. Bars show the four
        behaviours Kargo&apos;s best hires share, 0–3 each.
      </p>

      {data.pending.length > 0 && (
        <div className="card px-5 py-3 text-sm">
          {data.pending.map((p) => (
            <p key={p.id} className="flex flex-wrap justify-between gap-2 py-1">
              <Link href={`/candidates/${p.id}`} className="font-medium hover:underline">
                {p.name}
              </Link>
              <span className={p.status === "error" ? "text-bad" : "text-muted"}>{p.status === "error" ? p.error : "Scoring…"}</span>
            </p>
          ))}
        </div>
      )}

      <Workspace role={meta.role} candidates={data.ranked} hires={data.hires} flaggedForSpm={data.flaggedForSpm} />
    </div>
  );
}
