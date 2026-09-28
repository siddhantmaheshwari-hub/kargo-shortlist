export type Role = "PM" | "SPM";
export type CriterionKey = "A" | "B" | "C" | "D";
export type Level = 0 | 1 | 2 | 3;
export type Band = "Shortlist" | "Second look" | "Decline";
export type Relocation = "mumbai" | "willing" | "unknown" | "not_willing";
export type Override = "Spike" | "Unclear" | "Cross-route" | "Knockout";

/** One criterion as scored against the CV. Levels are enforced in code, not trusted from the model. */
export interface CriterionScore {
  pm: Level;
  spm: Level;
  unclear: boolean; // the rubric's "?" mark
  evidence: string; // verbatim CV phrase that justifies the score ("" when level 0)
  verified: boolean; // evidence was found in the CV text
  rationale: string;
}

export interface Assessment {
  criteria: Record<CriterionKey, CriterionScore>;
  relocation: Relocation;
  location: string | null;
  model: string;
}

export interface RubricResult {
  total: number;
  baseBand: Band;
  band: Band;
  overrides: Override[];
}

export interface Evaluation {
  pm: RubricResult;
  spm: RubricResult;
  unclearCount: number;
  listRole: Role;
  band: Band;
  total: number;
  overrides: Override[];
  flaggedSpm: boolean;
}

export interface Probe {
  criterion: CriterionKey | "Location";
  question: string;
  why: string;
}

export interface Brief {
  who: string;
  whyRanked: string;
  probes: Probe[];
  generatedBy: "gemini" | "template";
}

export interface CandidateRow {
  id: string;
  name: string;
  email: string | null;
  location: string | null;
  relocation: Relocation | null;
  role_applied: Role;
  file_name: string | null;
  cv_text: string;
  status: "processing" | "scored" | "error";
  error: string | null;
  assessment: Assessment | null;
  pm_total: number | null;
  spm_total: number | null;
  list_role: Role | null;
  band: Band | null;
  total: number | null;
  overrides: Override[];
  unclear_count: number;
  flagged_spm: boolean;
  brief: Brief | null;
  decision: "advance" | "pass" | null;
  decided_at: string | null;
  created_at: string;
}

export interface EmailRow {
  id: string;
  candidate_id: string;
  kind: "invite" | "rejection";
  to_email: string | null;
  subject: string;
  body: string;
  status: "draft" | "sent" | "failed";
  provider_id: string | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface PastHireRow {
  id: string;
  name: string;
  file_name: string;
  rating: "Exceeds" | "Meets" | "Below";
  thriving: boolean;
  had_pm_title: boolean;
  cv_text: string;
  assessment: Assessment | null;
  pm_total: number | null;
  spm_total: number | null;
  calibrated_at: string | null;
}
