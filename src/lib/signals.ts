// Deterministic, human-readable signals derived from a scorecard: the must-have
// checklist, the one deal-breaker, red flags, tags and suggested decision reasons.
// Pure: safe for client and server. Every item carries a short, specific reason.

import { CRITERIA, levelsFor } from "./rubric";
import type { Assessment, Band, CriterionKey, Level, Override, Relocation, Role } from "./types";

export type MustHaveStatus = "strong" | "partial" | "weak" | "missing" | "unclear";

export interface MustHave {
  key: CriterionKey;
  name: string;
  level: Level;
  status: MustHaveStatus;
  /** One line: what the rubric needs vs what the CV shows. */
  reason: string;
  evidence: string;
  verified: boolean;
}

export interface Flag {
  tone: "bad" | "warn" | "info" | "good";
  label: string;
  detail: string;
}

/** What a CV needs to show for the next level up, per criterion (from rubric v2). */
const NEEDS: Record<CriterionKey, Record<1 | 2 | 3, string>> = {
  A: {
    1: "any operations work, even from a desk",
    2: "handled live transactions in an operations-heavy domain",
    3: "named volumes and counterparties (carriers, CHAs, customs, ports)",
  },
  B: {
    1: "built something beyond assigned work",
    2: "an unprompted fix their team adopted",
    3: "a fix triggered by a breakdown, adopted by others with a number",
  },
  C: {
    1: "any incident handled",
    2: "a specific incident resolved, with the outcome",
    3: "an unscheduled breakdown owned end to end, with the outcome",
  },
  D: {
    1: "any extra load taken on",
    2: "took on extra scope",
    3: "extra volume with no added headcount, and the outcome held",
  },
};

const SPM_NEEDS: Record<CriterionKey, string> = {
  A: "coordination point across 3+ types of external party",
  B: "the fix spread to other teams, clients, or the platform",
  C: "final call on a high-stakes event (migration, outage, inspection)",
  D: "extra load sustained for 6+ months without headcount",
};

export function mustHaves(a: Assessment, role: Role): MustHave[] {
  const levels = levelsFor(a, role);
  return CRITERIA.map(({ key, name }) => {
    const c = a.criteria[key];
    const level = levels[key];
    let status: MustHaveStatus;
    let reason: string;
    if (c.unclear) {
      status = "unclear";
      reason = c.verified
        ? `Hinted at but unclear · Ask in interview`
        : `Claim not found word-for-word in the CV · Verify in interview`;
    } else if (level === 3) {
      status = "strong";
      reason = role === "SPM" ? `Meets the SPM bar: ${SPM_NEEDS[key]}` : "Clear, specific evidence";
    } else if (level === 0) {
      status = "missing";
      reason = `Not shown · Needs: ${NEEDS[key][2]}`;
    } else {
      status = level === 2 ? "partial" : "weak";
      const next = role === "SPM" && level === 2 && a.criteria[key].pm === 3 ? SPM_NEEDS[key] : NEEDS[key][(level + 1) as 2 | 3];
      reason = `For a 3 it needs: ${next}`;
    }
    return { key, name, level, status, reason, evidence: c.evidence, verified: c.verified };
  });
}

const RELOCATION_TEXT: Record<Relocation, string> = {
  mumbai: "Mumbai-based",
  willing: "Willing to relocate to Mumbai",
  unknown: "Doesn't say if they'd relocate",
  not_willing: "Rules out Mumbai",
};

/** The only deal-breaker in the rubric: Mumbai-based or willing to relocate. */
export function locationCheck(a: Assessment): Flag {
  const where = a.location ? ` · Based in ${a.location}` : "";
  if (a.relocation === "not_willing") {
    return { tone: "bad", label: "Deal-breaker", detail: `Required: Mumbai or relocating · CV: ${RELOCATION_TEXT.not_willing}${where}` };
  }
  if (a.relocation === "unknown") {
    return { tone: "warn", label: "Check relocation", detail: `${RELOCATION_TEXT.unknown}${where}` };
  }
  return { tone: "good", label: RELOCATION_TEXT[a.relocation], detail: a.location ?? "" };
}

export function redFlags(input: {
  assessment: Assessment;
  role: Role;
  email: string | null;
  unclearCount: number;
}): Flag[] {
  const { assessment: a, role, email, unclearCount } = input;
  const flags: Flag[] = [];
  const levels = levelsFor(a, role);
  const unverified = CRITERIA.filter(({ key }) => a.criteria[key].pm >= 1 && !a.criteria[key].verified);
  if (unverified.length) {
    flags.push({
      tone: "bad",
      label: "Claim not found in CV",
      detail: `Evidence for ${unverified.map((c) => c.key).join(", ")} couldn't be matched to the CV text`,
    });
  }
  if (levels.A === 0) {
    flags.push({
      tone: "warn",
      label: "No hands-on operations",
      detail: "Every thriving past hire had it. This CV shows none, in any role",
    });
  }
  if (unclearCount >= 2) {
    flags.push({ tone: "warn", label: "Thin CV", detail: `${unclearCount} criteria are unclear, so it gets a second look` });
  }
  if (!email) {
    flags.push({ tone: "warn", label: "No email on CV", detail: "The follow-up email can't be sent until one is added" });
  }
  return flags;
}

export function tags(input: { overrides: Override[]; flaggedSpm: boolean; roleApplied: Role; listRole: Role | null; spmTotal: number | null }): Flag[] {
  const out: Flag[] = [];
  if (input.overrides.includes("Spike")) out.push({ tone: "info", label: "Spike", detail: "A 3 on ops exposure or unprompted fix" });
  if (input.overrides.includes("Unclear")) out.push({ tone: "info", label: "Unclear", detail: "2+ unclear scores" });
  if (input.listRole && input.roleApplied !== input.listRole) {
    out.push({ tone: "info", label: `Moved from ${input.roleApplied}`, detail: `Missed the ${input.roleApplied} shortlist, clears the ${input.listRole} bar` });
  }
  if (input.flaggedSpm) out.push({ tone: "good", label: "Consider for SPM", detail: `Scores ${input.spmTotal} on the SPM rubric` });
  return out;
}

const LOWER: Record<CriterionKey, string> = {
  A: "hands-on operations exposure",
  B: "unprompted fixes others adopted",
  C: "owning live breakdowns",
  D: "absorbing extra load",
};

/** Reasons to pre-fill when passing; the first is the default. Drawn from the scorecard. */
export function passReasons(a: Assessment | null, role: Role, band: Band | null): string[] {
  const out: string[] = [];
  if (a?.relocation === "not_willing") out.push("Can't work from Mumbai");
  if (a) {
    const levels = levelsFor(a, role);
    const weakest = [...CRITERIA]
      .filter(({ key }) => levels[key] <= 1)
      .sort((x, y) => levels[x.key] - levels[y.key]);
    for (const { key } of weakest.slice(0, 2)) out.push(`Little evidence of ${LOWER[key]}`);
  }
  if (band === "Shortlist" || out.length === 0) out.push("Stronger candidates for this role");
  out.push("Profile doesn't fit this role");
  return Array.from(new Set(out));
}

export function advanceReason(a: Assessment | null, role: Role): string {
  if (!a) return "Advanced";
  const levels = levelsFor(a, role);
  const strong = CRITERIA.filter(({ key }) => levels[key] === 3).map(({ key }) => LOWER[key]);
  return strong.length ? `Strong on ${strong.slice(0, 2).join(" and ")}` : "Worth a conversation";
}
