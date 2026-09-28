import "server-only";
import { generateJson } from "./gemini";
import { CRITERIA, WEIGHTS, levelsFor, standardProbes } from "./rubric";
import type { Assessment, Brief, Evaluation, Probe, Role } from "./types";

const SYSTEM = `
You write short candidate briefs for Arjun Mehta, founder of Kargo (Mumbai logistics SaaS), who is
hiring a Product Manager and a Senior Product Manager. He reads these late at night: be concrete,
plain, and brief. No hype, no adjectives about the candidate's personality.

The candidate has ALREADY been scored by a fixed rubric. You must not change or second-guess the
scores, band or totals: explain them. Kargo's best past hires shared four behaviours, often without
PM titles: hands-on operations exposure (A), unprompted fixes adopted by others (B), personally
resolving live breakdowns (C), absorbing extra load without asking for headcount (D). Titles,
years, degrees, company names and tools are deliberately NOT scored; do not cite them as reasons.

Return:
- who: 2-3 sentences. Who this person is and what they've actually done (from the CV).
- why_ranked: 2-4 sentences. Why they landed in this band, naming the strongest and weakest
  criteria with the evidence. Mention any override that applied.
- probes: 2-3 interview questions specific to THIS CV, aimed at the weakest or least certain
  criteria, or at checking a strong claim is really theirs. Each with a one-line why.
`.trim();

const SCHEMA = {
  type: "object",
  properties: {
    who: { type: "string" },
    why_ranked: { type: "string" },
    probes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          criterion: { type: "string", enum: ["A", "B", "C", "D", "Location"] },
          question: { type: "string" },
          why: { type: "string" },
        },
        required: ["criterion", "question", "why"],
      },
    },
  },
  required: ["who", "why_ranked", "probes"],
};

function scorecardText(a: Assessment, ev: Evaluation, roleApplied: Role): string {
  const role = ev.listRole;
  const levels = levelsFor(a, role);
  const lines = CRITERIA.map(({ key, name }) => {
    const c = a.criteria[key];
    return `${key}. ${name} (weight ${WEIGHTS[role][key]}%): ${levels[key]}/3${c.unclear ? " ?" : ""}. Evidence: ${c.evidence || "none"}. ${c.rationale}`;
  });
  return [
    `Applied for: ${roleApplied}. Ranked on the ${role} list.`,
    `Band: ${ev.band}. Total: ${ev.total}/100 on the ${role} rubric (PM rubric ${ev.pm.total}, SPM rubric ${ev.spm.total}).`,
    `Overrides applied: ${ev.overrides.length ? ev.overrides.join(", ") : "none"}.`,
    ev.flaggedSpm ? "Flagged for SPM: scores 70+ on the SPM rubric." : "",
    `Location: ${a.location ?? "not stated"} (relocation: ${a.relocation}).`,
    ...lines,
  ]
    .filter(Boolean)
    .join("\n");
}

function templateBrief(a: Assessment, ev: Evaluation): Omit<Brief, "probes" | "generatedBy"> {
  const levels = levelsFor(a, ev.listRole);
  const sorted = [...CRITERIA].sort((x, y) => levels[y.key] - levels[x.key]);
  const top = sorted[0];
  const low = sorted[sorted.length - 1];
  return {
    who: a.criteria[top.key].evidence
      ? `Strongest evidence: "${a.criteria[top.key].evidence}"`
      : "The CV gives little direct evidence on the four criteria.",
    whyRanked: `${ev.band} at ${ev.total}/100 on the ${ev.listRole} rubric. Strongest on ${top.name.toLowerCase()} (${levels[top.key]}/3), weakest on ${low.name.toLowerCase()} (${levels[low.key]}/3).${ev.overrides.length ? ` Overrides: ${ev.overrides.join(", ")}.` : ""}`,
  };
}

export async function writeBrief(cvText: string, a: Assessment, ev: Evaluation, roleApplied: Role): Promise<Brief> {
  const standard = standardProbes(a, ev.listRole);
  try {
    const raw = await generateJson<{ who: string; why_ranked: string; probes: Probe[] }>({
      system: SYSTEM,
      prompt: `SCORECARD\n${scorecardText(a, ev, roleApplied)}\n\n<cv>\n${cvText.slice(0, 30000)}\n</cv>`,
      schema: SCHEMA,
      temperature: 0.3,
    });
    return {
      who: raw.who.trim(),
      whyRanked: raw.why_ranked.trim(),
      // Rubric probes are always included for scores of 1 or "?"; Gemini adds CV-specific ones.
      probes: [...standard, ...raw.probes.slice(0, 3)],
      generatedBy: "gemini",
    };
  } catch {
    return { ...templateBrief(a, ev), probes: standard, generatedBy: "template" };
  }
}
