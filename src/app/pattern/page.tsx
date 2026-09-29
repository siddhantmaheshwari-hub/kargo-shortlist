import Image from "next/image";
import { ActionButton } from "@/components/ActionButton";
import { Avatar, BandChip, CriterionBars, SetupNotice } from "@/components/ui";
import { pastHires } from "@/lib/data";
import { BANDS, CRITERIA, PROBES, WEIGHTS, scoreRubric } from "@/lib/rubric";

const SHIP_PHOTO = "https://images.unsplash.com/photo-1578575437130-527eed3abbec";

// Where each behaviour shows up in Kargo's own hires (from the rubric's calibration notes).
const WHERE_IT_SHOWS: Record<string, string> = {
  A: "Rohan ran 180+ shipments a month at a CHA firm. Lavanya handled 800+ a month across carriers. Sunita was the coordination point between CHAs, freight agents, ports and DGFT.",
  B: "Rohan's Excel tracker was adopted by the 12-person ops team in two weeks, and his BoL module became a core platform feature. Lavanya's dashboard spread to 2 other regional teams.",
  C: "Meghna cleared a 7pm customs hold overnight and the shipment left on schedule. Sunita rebuilt a workflow over a weekend when a vendor changed format without notice.",
  D: "Meghna covered 8 extra accounts for 3 months with no churn. Rohan absorbed 18 months of extra volume with no added headcount.",
};

export default async function PatternPage() {
  let hires: Awaited<ReturnType<typeof pastHires>>;
  try {
    hires = await pastHires();
  } catch (e) {
    return <SetupNotice error={e} />;
  }

  const calibrated = hires.filter((h) => h.assessment);
  const best = (h: (typeof hires)[number]) => Math.max(h.pm_total ?? 0, h.spm_total ?? 0);
  const sorted = [...hires].sort((a, b) => best(b) - best(a));
  const thriving = calibrated.filter((h) => h.thriving);
  const others = calibrated.filter((h) => !h.thriving);
  const minThriving = thriving.length ? Math.min(...thriving.map(best)) : null;
  const maxOthers = others.length ? Math.max(...others.map(best)) : null;
  const titled = hires.filter((h) => h.thriving && h.had_pm_title).length;
  const thrivingCount = hires.filter((h) => h.thriving).length;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[1.5rem]">
        <Image src={SHIP_PHOTO} alt="Container ship at a port berth" width={1600} height={500} sizes="(min-width: 1024px) 80vw, 100vw" className="h-60 w-full object-cover" priority />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(10_40_38/0.85)_0%,rgb(10_40_38/0.5)_60%,rgb(10_40_38/0.1)_100%)]" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 text-white sm:p-8">
          <p className="text-sm text-white/70">Success pattern</p>
          <h1 className="mt-1 max-w-2xl font-display text-3xl leading-tight font-medium tracking-tight sm:text-4xl">
            Kargo&apos;s best hires didn&apos;t match the JD. They shared four behaviours.
          </h1>
          {hires.length > 0 && (
            <p className="mt-2 max-w-xl text-sm text-white/80">
              Only {titled} of {thrivingCount} thriving hires ever held a PM title. What predicts success shows up in any role, in any
              industry.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {CRITERIA.map((c) => (
          <div key={c.key} className="card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft font-display text-sm font-medium text-accent">{c.key}</span>
                <h2 className="font-display text-lg leading-tight font-medium">{c.name}</h2>
              </div>
              <span className="tabular shrink-0 rounded-full bg-sunk px-2.5 py-1 text-xs text-muted">
                PM {WEIGHTS.PM[c.key]}% · SPM {WEIGHTS.SPM[c.key]}%
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">{WHERE_IT_SHOWS[c.key]}</p>
            <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
              <span className="text-faint">Interview probe · </span>&ldquo;{PROBES[c.key]}&rdquo;
            </p>
          </div>
        ))}
      </div>

      <div className="card p-5 text-sm leading-relaxed text-ink-2 sm:p-6">
        <span className="font-medium text-ink">How bands work.</span> PM: Shortlist {BANDS.PM.shortlist}+, Second look {BANDS.PM.secondLook}–
        {BANDS.PM.shortlist - 1}. SPM: Shortlist {BANDS.SPM.shortlist}+, Second look {BANDS.SPM.secondLook}–{BANDS.SPM.shortlist - 1}.
        Rules that stop good CVs being auto-rejected: a 3 on A or B, or two unclear scores, guarantees a second look, and SPM applicants
        who clear the PM bar move to the PM shortlist. The only deal-breaker is being unable to work in Mumbai. Titles, years, degrees,
        companies and tools are never scored.
      </div>

      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-medium">Calibration: does it pick Kargo&apos;s best hires?</h2>
            <p className="mt-1 text-sm text-muted">The 8 past hires, scored by the same scorer used for candidates.</p>
          </div>
          <ActionButton url="/api/calibrate" label={calibrated.length ? "Re-run calibration" : "Run calibration"} busyLabel="Scoring 8 hires…" />
        </div>

        {hires.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No past hires loaded. Run <code>npm run seed</code> to load the CVs from <code>hires/</code>.
          </p>
        ) : (
          <>
            {minThriving !== null && maxOthers !== null && (
              <p
                className={`mt-4 rounded-2xl px-4 py-3 text-sm ${minThriving > maxOthers ? "bg-good-bg text-good" : "bg-warn-bg text-warn"}`}
              >
                {minThriving > maxOthers
                  ? `Clean separation: every thriving hire scores ${minThriving}+, every Meets/Below hire scores ${maxOthers} or less.`
                  : `Overlap: a thriving hire scored ${minThriving} while a Meets/Below hire scored ${maxOthers}. Review their scorecards.`}
              </p>
            )}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="text-xs text-faint">
                  <tr className="border-b border-line">
                    <th className="py-2.5 pr-3 font-normal">#</th>
                    <th className="py-2.5 pr-3 font-normal">Hire</th>
                    <th className="py-2.5 pr-3 font-normal">Outcome</th>
                    <th className="py-2.5 pr-3 font-normal">PM title?</th>
                    <th className="py-2.5 pr-3 font-normal">A B C D</th>
                    <th className="py-2.5 pr-3 font-normal">PM</th>
                    <th className="py-2.5 font-normal">SPM</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((h, i) => (
                    <tr key={h.id} className="border-b border-line last:border-0">
                      <td className="tabular py-3 pr-3 text-faint">{i + 1}</td>
                      <td className="py-3 pr-3">
                        <span className="flex items-center gap-2.5">
                          <Avatar name={h.name} size={30} />
                          <span className="font-medium">{h.name}</span>
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${h.thriving ? "bg-good-bg text-good" : "bg-sunk text-muted"}`}>
                          {h.rating}
                          {h.thriving ? " · thriving" : ""}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-muted">{h.had_pm_title ? "Yes" : "No"}</td>
                      <td className="py-3 pr-3">{h.assessment ? <CriterionBars assessment={h.assessment} role="PM" /> : "–"}</td>
                      <td className="py-3 pr-3">
                        {h.assessment ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="tabular w-7 font-display text-base">{h.pm_total}</span>
                            <BandChip band={scoreRubric(h.assessment, "PM").band} />
                          </span>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="py-3">
                        {h.assessment ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="tabular w-7 font-display text-base">{h.spm_total}</span>
                            <BandChip band={scoreRubric(h.assessment, "SPM").band} />
                          </span>
                        ) : (
                          "–"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
