// Pure rules applied to the model's raw output (no server-only imports, so tests can use them).
import { toSpmLevel } from "./rubric";
import type { CriterionScore, Level } from "./types";

export interface RawCriterion {
  pm_level: number;
  spm_bar_met: boolean;
  unclear: boolean;
  evidence: string;
  rationale: string;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”"'`]/g, "")
    .replace(/[–—‒\-–—▪·•|]/g, " ")
    .replace(/[^\p{L}\p{N}%₹+.\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the quoted evidence actually appears in the CV (exact, or ~all its words in order-free match). */
export function evidenceInCv(evidence: string, cvText: string): boolean {
  const q = normalize(evidence);
  if (!q) return false;
  const cv = normalize(cvText);
  if (cv.includes(q)) return true;
  const cvWords = new Set(cv.split(" "));
  const words = q.split(" ").filter((w) => w.length >= 3);
  if (words.length < 4) return false;
  const hits = words.filter((w) => cvWords.has(w)).length;
  return hits / words.length >= 0.9;
}

function clampLevel(n: number): Level {
  const r = Math.max(0, Math.min(3, Math.round(Number(n) || 0)));
  return r as Level;
}

/** Enforce the rubric's rules on the model's raw output. */
export function finalizeCriterion(raw: RawCriterion, cvText: string): CriterionScore {
  let pm = clampLevel(raw.pm_level);
  let unclear = Boolean(raw.unclear);
  const evidence = (raw.evidence || "").trim();
  const verified = pm === 0 ? true : evidenceInCv(evidence, cvText);
  let rationale = (raw.rationale || "").trim();

  // Evidence the CV doesn't contain can't carry a score: treat it as "hinted but unclear".
  if (pm >= 1 && !verified) {
    unclear = true;
    rationale = `Quoted evidence could not be found in the CV, so this is marked unclear. ${rationale}`;
  }
  // "?" always means a 1 (never 0, never higher).
  if (unclear) pm = 1;

  return {
    pm,
    spm: toSpmLevel(pm, pm === 3 && Boolean(raw.spm_bar_met)),
    unclear,
    evidence: pm === 0 ? "" : evidence,
    verified,
    rationale,
  };
}
