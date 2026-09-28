import { ActionButton } from "@/components/ActionButton";
import { BandBadge, Card, LevelPips, SetupNotice } from "@/components/ui";
import { pastHires } from "@/lib/data";
import { BANDS, CRITERIA, PROBES, WEIGHTS, scoreRubric } from "@/lib/rubric";

// What each criterion looks like in Kargo's own hires, from the rubric's calibration notes.
const WHERE_IT_SHOWS: Record<string, string> = {
  A: "Rohan ran 180+ shipments a month at a CHA firm. Lavanya handled 800+ a month across carriers. Sunita was the coordination point between CHAs, freight agents, ports and DGFT.",
  B: "Rohan's Excel tracker was adopted by the 12-person ops team in two weeks; his BoL module became a core platform feature. Lavanya's dashboard spread to 2 other regional teams.",
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
  const thriving = calibrated.filter((h) => h.thriving);
  const others = calibrated.filter((h) => !h.thriving);
  const minThriving = thriving.length ? Math.min(...thriving.map((h) => Math.max(h.pm_total ?? 0, h.spm_total ?? 0))) : null;
  const maxOthers = others.length ? Math.max(...others.map((h) => Math.max(h.pm_total ?? 0, h.spm_total ?? 0))) : null;
  const titled = hires.filter((h) => h.thriving && h.had_pm_title).length;
  const thrivingCount = hires.filter((h) => h.thriving).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">The success pattern</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Arjun has been screening against the JD. His best hires didn&apos;t match it
          {hires.length > 0 && (
            <>
              : only {titled} of {thrivingCount} who are thriving held a PM title
            </>
          )}
          . What they share is four behaviours, which show up in any role or industry. Titles, years, degrees, company
          names and tools are never scored.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {CRITERIA.map((c) => (
          <Card key={c.key}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-semibold">
                <span className="font-mono text-muted">{c.key}</span> {c.name}
              </h2>
              <span className="shrink-0 font-mono text-xs text-muted">
                PM {WEIGHTS.PM[c.key]}% · SPM {WEIGHTS.SPM[c.key]}%
              </span>
            </div>
            <p className="mt-2 text-sm">{WHERE_IT_SHOWS[c.key]}</p>
            <p className="mt-2 text-xs text-muted">Interview probe: &ldquo;{PROBES[c.key]}&rdquo;</p>
          </Card>
        ))}
      </div>

      <Card>
        <p className="text-sm">
          <span className="font-medium">Bands.</span> PM: Shortlist ≥ {BANDS.PM.shortlist}, Second look{" "}
          {BANDS.PM.secondLook}–{BANDS.PM.shortlist - 1}. SPM: Shortlist ≥ {BANDS.SPM.shortlist}, Second look{" "}
          {BANDS.SPM.secondLook}–{BANDS.SPM.shortlist - 1}. <span className="font-medium">Overrides</span> stop good CVs
          being auto-rejected: a 3 on A or B, or two unclear scores, guarantees a second look; SPM applicants who clear the
          PM bar move to the PM shortlist. The only knockout is not being willing to work in Mumbai.
        </p>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Calibration: does it pick Kargo&apos;s best hires?</h2>
            <p className="mt-1 text-sm text-muted">
              The 8 past hires are scored by the same scorer used for candidates.
            </p>
          </div>
          <ActionButton
            url="/api/calibrate"
            label={calibrated.length ? "Re-run calibration" : "Run calibration"}
            busyLabel="Scoring 8 hires…"
          />
        </div>

        {hires.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No past hires loaded. Run <code>npm run seed</code> to load the CVs from <code>hires/</code>.
          </p>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-3 font-medium">Hire</th>
                    <th className="py-2 pr-3 font-medium">Rating</th>
                    <th className="py-2 pr-3 font-medium">PM title?</th>
                    <th className="py-2 pr-3 font-medium">Criteria (PM)</th>
                    <th className="py-2 pr-3 font-medium">PM</th>
                    <th className="py-2 font-medium">SPM</th>
                  </tr>
                </thead>
                <tbody>
                  {hires.map((h) => (
                    <tr key={h.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-3 font-medium">{h.name}</td>
                      <td className={`py-2.5 pr-3 ${h.thriving ? "text-good" : "text-muted"}`}>{h.rating}</td>
                      <td className="py-2.5 pr-3 text-muted">{h.had_pm_title ? "Yes" : "No"}</td>
                      <td className="py-2.5 pr-3">
                        {h.assessment ? <LevelPips assessment={h.assessment} role="PM" /> : <span className="text-muted">–</span>}
                      </td>
                      <td className="py-2.5 pr-3">
                        {h.assessment ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="font-mono">{h.pm_total}</span>
                            <BandBadge band={scoreRubric(h.assessment, "PM").band} />
                          </span>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="py-2.5">
                        {h.assessment ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="font-mono">{h.spm_total}</span>
                            <BandBadge band={scoreRubric(h.assessment, "SPM").band} />
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
            {minThriving !== null && maxOthers !== null && (
              <p className="mt-4 text-sm">
                {minThriving > maxOthers ? (
                  <span className="text-good">
                    Clean separation: the lowest-scoring thriving hire ({minThriving}) is above the highest-scoring
                    Meets/Below hire ({maxOthers}).
                  </span>
                ) : (
                  <span className="text-warn">
                    Overlap: a thriving hire scored {minThriving} while a Meets/Below hire scored {maxOthers}. Review
                    their scorecards before trusting the ranking.
                  </span>
                )}
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
