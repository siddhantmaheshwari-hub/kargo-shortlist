// Kargo CV Scoring Rubric v2, as deterministic code.
// Gemini reads the CV and proposes levels + evidence; everything below (SPM
// conversion, "?" handling, totals, bands, overrides, cross-routing, ranking)
// is computed here so the same inputs always produce the same ranking.

import type {
  Assessment,
  Band,
  CriterionKey,
  Evaluation,
  Level,
  Override,
  Probe,
  Role,
  RubricResult,
} from "./types";

export const CRITERIA: { key: CriterionKey; name: string; short: string }[] = [
  { key: "A", name: "Hands-on operations exposure", short: "Ops exposure" },
  { key: "B", name: "Unprompted fix, adopted by others", short: "Unprompted fix" },
  { key: "C", name: "Resolves live breakdowns personally", short: "Owns breakdowns" },
  { key: "D", name: "Absorbs extra load without asking for more people", short: "Absorbs load" },
];

export const WEIGHTS: Record<Role, Record<CriterionKey, number>> = {
  PM: { A: 30, B: 30, C: 25, D: 15 },
  SPM: { A: 25, B: 30, C: 30, D: 15 },
};

export const BANDS: Record<Role, { shortlist: number; secondLook: number }> = {
  PM: { shortlist: 65, secondLook: 40 },
  SPM: { shortlist: 70, secondLook: 45 },
};

export const CROSS_ROUTE = { spmToPm: 65, pmToSpm: 70 };

export const PROBES: Record<CriterionKey, string> = {
  A: "Walk me through a normal day in that operations role. Who did you deal with, and how many shipments or cases?",
  B: "What's something you built that nobody asked for? Who uses it now?",
  C: "Tell me about the worst thing that broke on your watch. What did you do in the first hour?",
  D: "When did your workload jump without extra people? What did you change to cope?",
};

export const RELOCATION_PROBE =
  "This role is in-office in Mumbai. Are you based here, or open to relocating?";

export const BAND_ORDER: Band[] = ["Shortlist", "Second look", "Decline"];

/** SPM level from the PM level: a PM-level 3 is a 2 on SPM unless the extra SPM bar is met. */
export function toSpmLevel(pm: Level, spmBarMet: boolean): Level {
  if (pm === 3) return spmBarMet ? 3 : 2;
  return pm;
}

function baseBand(role: Role, total: number): Band {
  const b = BANDS[role];
  if (total >= b.shortlist) return "Shortlist";
  if (total >= b.secondLook) return "Second look";
  return "Decline";
}

export function levelsFor(a: Assessment, role: Role): Record<CriterionKey, Level> {
  const out = {} as Record<CriterionKey, Level>;
  for (const { key } of CRITERIA) {
    out[key] = role === "PM" ? a.criteria[key].pm : a.criteria[key].spm;
  }
  return out;
}

export function totalFor(levels: Record<CriterionKey, Level>, role: Role): number {
  let sum = 0;
  for (const { key } of CRITERIA) sum += (levels[key] / 3) * WEIGHTS[role][key];
  return Math.round(sum);
}

export function countUnclear(a: Assessment): number {
  return CRITERIA.filter(({ key }) => a.criteria[key].unclear).length;
}

/** Score one CV on one rubric, with the Spike and Unclear override rules. */
export function scoreRubric(a: Assessment, role: Role): RubricResult {
  const levels = levelsFor(a, role);
  const total = totalFor(levels, role);
  const base = baseBand(role, total);
  let band = base;
  const overrides: Override[] = [];

  if (band === "Decline" && (levels.A === 3 || levels.B === 3)) {
    band = "Second look";
    overrides.push("Spike");
  }
  if (countUnclear(a) >= 2 && band === "Decline") {
    band = "Second look";
    overrides.push("Unclear");
  }
  return { total, baseBand: base, band, overrides };
}

/** Full evaluation: both rubrics, cross-routing, and the relocation knockout. */
export function evaluate(a: Assessment, roleApplied: Role): Evaluation {
  const pm = scoreRubric(a, "PM");
  const spm = scoreRubric(a, "SPM");
  const unclearCount = countUnclear(a);

  let listRole: Role = roleApplied;
  let result = roleApplied === "PM" ? pm : spm;
  let overrides: Override[] = [...result.overrides];
  let flaggedSpm = false;

  if (roleApplied === "SPM" && spm.band !== "Shortlist" && pm.total >= CROSS_ROUTE.spmToPm) {
    // Misses the SPM shortlist but clears PM: goes to the PM shortlist.
    listRole = "PM";
    result = { ...pm, band: "Shortlist" };
    overrides = ["Cross-route"];
  }
  if (roleApplied === "PM" && spm.total >= CROSS_ROUTE.pmToSpm) {
    flaggedSpm = true;
    overrides.push("Cross-route");
  }

  let band = result.band;
  // The only knockout: explicitly not Mumbai-based and not willing to relocate.
  if (a.relocation === "not_willing") {
    band = "Decline";
    overrides = ["Knockout"];
  }

  return {
    pm,
    spm,
    unclearCount,
    listRole,
    band,
    total: result.total,
    overrides,
    flaggedSpm,
  };
}

/** Standard rubric probes for every score of 1 or "?", plus relocation if unknown. */
export function standardProbes(a: Assessment, role: Role): Probe[] {
  const probes: Probe[] = [];
  const levels = levelsFor(a, role);
  for (const { key, name } of CRITERIA) {
    const c = a.criteria[key];
    if (c.unclear || levels[key] <= 1) {
      probes.push({
        criterion: key,
        question: PROBES[key],
        why: c.unclear
          ? `${name}: the CV hints at this but is unclear (scored 1?).`
          : `${name}: scored ${levels[key]}, so the CV gives little evidence either way.`,
      });
    }
  }
  if (a.relocation === "unknown") {
    probes.push({
      criterion: "Location",
      question: RELOCATION_PROBE,
      why: "The CV doesn't say whether they're Mumbai-based or willing to relocate.",
    });
  }
  return probes;
}

/** Sort key for a ranked list: band first, then total, then count of 3s. */
export function rankCompare(
  x: { band: Band | null; total: number | null; assessment: Assessment | null; list_role: Role | null },
  y: { band: Band | null; total: number | null; assessment: Assessment | null; list_role: Role | null },
): number {
  const bx = x.band ? BAND_ORDER.indexOf(x.band) : 9;
  const by = y.band ? BAND_ORDER.indexOf(y.band) : 9;
  if (bx !== by) return bx - by;
  const tx = x.total ?? -1;
  const ty = y.total ?? -1;
  if (tx !== ty) return ty - tx;
  const threes = (r: typeof x) =>
    r.assessment && r.list_role
      ? Object.values(levelsFor(r.assessment, r.list_role)).filter((l) => l === 3).length
      : 0;
  return threes(y) - threes(x);
}

/** Closest past hire by cosine similarity of PM-level criterion vectors. */
export function closestHire<T extends { name: string; rating: string; thriving: boolean; assessment: Assessment | null }>(
  a: Assessment,
  hires: T[],
): { hire: T; similarity: number } | null {
  const vec = (x: Assessment) => CRITERIA.map(({ key }) => x.criteria[key].pm as number);
  const v = vec(a);
  const norm = (u: number[]) => Math.sqrt(u.reduce((s, n) => s + n * n, 0));
  let best: { hire: T; similarity: number } | null = null;
  for (const h of hires) {
    if (!h.assessment) continue;
    const w = vec(h.assessment);
    const denom = norm(v) * norm(w);
    const sim = denom === 0 ? 0 : v.reduce((s, n, i) => s + n * w[i], 0) / denom;
    // Tie-break toward the stronger profile (distance in magnitude).
    const adj = sim - Math.abs(norm(v) - norm(w)) / 20;
    if (!best || adj > best.similarity) best = { hire: h, similarity: adj };
  }
  return best;
}
