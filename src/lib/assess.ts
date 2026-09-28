import "server-only";
import { generateJson } from "./gemini";
import { env } from "./env";
import { finalizeCriterion, type RawCriterion } from "./evidence";
import { CRITERIA } from "./rubric";
import type { Assessment, CriterionKey, CriterionScore, Relocation } from "./types";

const RUBRIC_PROMPT = `
You are scoring a CV against the Kargo CV Scoring Rubric (v2) for Product Manager (PM) and
Senior Product Manager (SPM) roles at Kargo, a Mumbai logistics SaaS company.

Kargo's best hires mostly did NOT hold PM titles. Score BEHAVIOUR WHEREVER IT APPEARS: any role,
any function, any industry, including pre-PM careers, family businesses, consulting, CS and sales.
NEVER score titles, years of experience, degree, company names, certifications, tool lists, or
adjectives in the summary. Score only what the CV states.

For each criterion give pm_level 0-3 using the anchors. If the CV hints at the behaviour but is
unclear, give pm_level 1 and unclear=true. A 0 means the behaviour is ABSENT, never merely unclear.
When pm_level is 3, also say whether the extra SPM bar is met (spm_bar_met).

A. HANDS-ON OPERATIONS EXPOSURE
 0  No operational role at all (product, tech or marketing only). e.g. a PM or marketer with only SaaS roles.
 1  Worked on operations from a desk (integrations, analytics, dashboards) without handling transactions.
    e.g. an engineer who integrated with logistics APIs.
 2  Handled live transactions in any operations-heavy domain, but no volumes or counterparties named.
 3  Names volumes AND counterparties (carriers, CHAs, customs, ports, clients).
    e.g. "180+ shipments monthly" coordinating with shipping lines and customs; "800+ shipments monthly" across carriers.
 SPM bar: PM-level 3 plus they were the coordination point across 3 or more TYPES of external party
    (e.g. "Primary coordination point between customs brokers (CHAs), freight agents, port authorities, and the DGFT office").
 Counts: freight, warehousing, FMCG distribution, field ops, fulfilment, pharma logistics, and CS or
 sales roles with a real operations load. Look for "shipments monthly", "coordinated with", "holds",
 "exceptions", "clearance", named counterparties.

B. UNPROMPTED FIX, ADOPTED BY OTHERS
 0  Nothing built beyond assigned work.
 1  Built something, but it was in their assigned remit, or there is no adoption evidence.
    e.g. an engineer's monitoring dashboard; a marketer's case-study programme (their job).
 2  Unprompted fix, adopted within their own team only. e.g. a PRD template adopted by the 4-person PM team.
 3  Triggered by a breakdown they noticed, then adopted by others, with a number or "became standard".
    e.g. a tracker built "after finding the team had no reliable way to know where each shipment stood;
    adopted across the 12-member operations team within two weeks".
 SPM bar: the fix outgrew where it started: it became a platform feature, or other teams or clients adopted it.
    e.g. a module "now a core platform feature"; a dashboard "adopted by 2 other regional teams".
 Look for "after noticing/finding", "adopted by", "became the standard", "now used by", "retained permanently".

C. RESOLVES LIVE BREAKDOWNS PERSONALLY
 0  No incident mentioned.
 1  Generic claims like "on-call" or "escalation management" with no specific case.
 2  A specific incident resolved within their assigned role or rota, with an outcome.
    e.g. a bug patched within 48 hours of being found via their own monitoring job.
 3  An unscheduled breakdown they owned end to end, with the outcome stated.
    e.g. a customs hold at 7pm resolved overnight with the CHA and customs, shipment departed on schedule;
    a workflow rebuilt over a weekend when a vendor changed format without notice, retained permanently.
 SPM bar: a high-stakes, hard-to-reverse event (migration, cutover, outage, inspection) where they were
    the final decision-maker, with the consequence stated. e.g. a vendor migration "with no data loss";
    an outage post-mortem owned to closure.

D. ABSORBS EXTRA LOAD WITHOUT ASKING FOR MORE PEOPLE
 0  Nothing, or they grew their team to handle the load (e.g. "hired a team of 4").
 1  Claims like "high-volume" or "fast-paced" only.
 2  Took on extra scope, but it was brief or no outcome is stated. e.g. "sole PM across 3 product areas".
 3  Explicitly took on extra volume or accounts with no added headcount, and the outcome held.
    e.g. covered 8 extra accounts for 3 months without additional headcount, no churn.
 SPM bar: the same, sustained for 6 months or more. e.g. "18-month period ... no additional headcount added".

EVIDENCE: for every criterion with pm_level >= 1, copy the single CV phrase that best justifies the
score VERBATIM (exact words from the CV, 5-40 words). For pm_level 0 use "". The rationale is one
short sentence naming which anchor applies.

LOCATION: extract the stated location. relocation = "mumbai" if based in Mumbai / Navi Mumbai / Thane /
JNPT area, "willing" if the CV says they will relocate to Mumbai, "not_willing" only if the CV
explicitly rules out Mumbai or relocation, otherwise "unknown".
`.trim();

const criterionSchema = {
  type: "object",
  properties: {
    pm_level: { type: "integer", minimum: 0, maximum: 3 },
    spm_bar_met: { type: "boolean" },
    unclear: { type: "boolean" },
    evidence: { type: "string" },
    rationale: { type: "string" },
  },
  required: ["pm_level", "spm_bar_met", "unclear", "evidence", "rationale"],
};

const SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    email: { type: ["string", "null"] },
    location: { type: ["string", "null"] },
    relocation: { type: "string", enum: ["mumbai", "willing", "unknown", "not_willing"] },
    criteria: {
      type: "object",
      properties: { A: criterionSchema, B: criterionSchema, C: criterionSchema, D: criterionSchema },
      required: ["A", "B", "C", "D"],
    },
  },
  required: ["name", "email", "location", "relocation", "criteria"],
};

interface RawAssessment {
  name: string;
  email: string | null;
  location: string | null;
  relocation: Relocation;
  criteria: Record<CriterionKey, RawCriterion>;
}

export async function assessCv(cvText: string): Promise<{
  name: string;
  email: string | null;
  assessment: Assessment;
}> {
  const raw = await generateJson<RawAssessment>({
    system: RUBRIC_PROMPT,
    prompt: `Score this CV.\n\n<cv>\n${cvText.slice(0, 30000)}\n</cv>`,
    schema: SCHEMA,
  });

  const criteria = {} as Record<CriterionKey, CriterionScore>;
  for (const { key } of CRITERIA) {
    const c = raw.criteria?.[key];
    criteria[key] = c
      ? finalizeCriterion(c, cvText)
      : { pm: 1, spm: 1, unclear: true, evidence: "", verified: false, rationale: "Not assessed." };
  }

  const relocation: Relocation = ["mumbai", "willing", "unknown", "not_willing"].includes(raw.relocation)
    ? raw.relocation
    : "unknown";

  const email = raw.email && /\S+@\S+\.\S+/.test(raw.email) ? raw.email.trim() : findEmail(cvText);

  return {
    name: (raw.name || "").trim() || "Unnamed candidate",
    email,
    assessment: { criteria, relocation, location: raw.location, model: env.geminiModel() },
  };
}

export function findEmail(text: string): string | null {
  const m = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0] : null;
}
