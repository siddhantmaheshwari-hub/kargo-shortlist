import { test } from "node:test";
import assert from "node:assert/strict";
import { toSpmLevel } from "../src/lib/rubric";
import { locationCheck, mustHaves, passReasons, redFlags, advanceReason } from "../src/lib/signals";
import type { Assessment, CriterionKey, Level, Relocation } from "../src/lib/types";

function make(levels: Record<CriterionKey, Level>, relocation: Relocation = "mumbai", opts: { unverified?: CriterionKey } = {}): Assessment {
  const criteria = {} as Assessment["criteria"];
  for (const k of ["A", "B", "C", "D"] as CriterionKey[]) {
    const pm = levels[k];
    criteria[k] = { pm, spm: toSpmLevel(pm, false), unclear: opts.unverified === k, evidence: pm ? "quote" : "", verified: opts.unverified !== k, rationale: "" };
  }
  return { criteria, relocation, location: "Pune", model: "test" };
}

test("must-haves give a short, specific reason for each gap", () => {
  const m = mustHaves(make({ A: 0, B: 2, C: 3, D: 1 }), "PM");
  assert.equal(m[0].status, "missing");
  assert.match(m[0].reason, /^Not shown · Needs: handled live transactions/);
  assert.equal(m[1].status, "partial");
  assert.match(m[1].reason, /For a 3 it needs: a fix triggered by a breakdown/);
  assert.equal(m[2].status, "strong");
  assert.equal(m[3].status, "weak");
});

test("SPM must-haves point to the SPM bar when a PM-level 3 is capped at 2", () => {
  const m = mustHaves(make({ A: 3, B: 0, C: 0, D: 0 }), "SPM");
  assert.equal(m[0].level, 2);
  assert.match(m[0].reason, /3\+ types of external party/);
});

test("location: deal-breaker only when the CV rules out Mumbai", () => {
  assert.equal(locationCheck(make({ A: 3, B: 3, C: 3, D: 3 }, "not_willing")).label, "Deal-breaker");
  assert.equal(locationCheck(make({ A: 3, B: 3, C: 3, D: 3 }, "unknown")).tone, "warn");
  assert.equal(locationCheck(make({ A: 3, B: 3, C: 3, D: 3 }, "willing")).tone, "good");
});

test("red flags: unverified claim, no ops, no email", () => {
  const f = redFlags({ assessment: make({ A: 0, B: 1, C: 0, D: 0 }, "mumbai", { unverified: "B" }), role: "PM", email: null, unclearCount: 1 });
  const labels = f.map((x) => x.label);
  assert.ok(labels.includes("Claim not found in CV"));
  assert.ok(labels.includes("No hands-on operations"));
  assert.ok(labels.includes("No email on CV"));
});

test("pass reasons are pre-filled from the weakest criteria", () => {
  const r = passReasons(make({ A: 0, B: 1, C: 3, D: 3 }), "PM", "Decline");
  assert.equal(r[0], "Little evidence of hands-on operations exposure");
  assert.equal(r[1], "Little evidence of unprompted fixes others adopted");
  assert.equal(passReasons(make({ A: 3, B: 3, C: 3, D: 3 }, "not_willing"), "PM", "Decline")[0], "Can't work from Mumbai");
  assert.equal(advanceReason(make({ A: 3, B: 3, C: 1, D: 0 }), "PM"), "Strong on hands-on operations exposure and unprompted fixes others adopted");
});
