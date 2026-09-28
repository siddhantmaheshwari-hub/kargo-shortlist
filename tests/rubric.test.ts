import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, scoreRubric, standardProbes, toSpmLevel } from "../src/lib/rubric";
import { evidenceInCv, finalizeCriterion } from "../src/lib/evidence";
import type { Assessment, CriterionKey, Level, Relocation } from "../src/lib/types";

type Spec = [pm: Level, spmBar?: boolean, unclear?: boolean];

function make(spec: Record<CriterionKey, Spec>, relocation: Relocation = "mumbai"): Assessment {
  const criteria = {} as Assessment["criteria"];
  for (const k of ["A", "B", "C", "D"] as CriterionKey[]) {
    const [pm, bar = false, unclear = false] = spec[k];
    criteria[k] = { pm, spm: toSpmLevel(pm, bar), unclear, evidence: "x", verified: true, rationale: "" };
  }
  return { criteria, relocation, location: "Mumbai", model: "test" };
}

// Calibration table from rubric.txt
test("Lavanya: PM 95 Shortlist, SPM 95 Shortlist", () => {
  const a = make({ A: [3, true], B: [3, true], C: [3, true], D: [2] });
  assert.deepEqual([scoreRubric(a, "PM").total, scoreRubric(a, "PM").band], [95, "Shortlist"]);
  assert.deepEqual([scoreRubric(a, "SPM").total, scoreRubric(a, "SPM").band], [95, "Shortlist"]);
});

test("Rohan: SPM 100 Shortlist", () => {
  const a = make({ A: [3, true], B: [3, true], C: [3, true], D: [3, true] });
  assert.equal(scoreRubric(a, "SPM").total, 100);
  assert.equal(scoreRubric(a, "SPM").band, "Shortlist");
});

test("Vikram 20, Preetham 37, Rahul 10: all Decline on PM", () => {
  const vikram = make({ A: [0], B: [2], C: [0], D: [0] });
  const preetham = make({ A: [1], B: [1], C: [2], D: [0] });
  const rahul = make({ A: [0], B: [1], C: [0], D: [0] });
  assert.deepEqual([scoreRubric(vikram, "PM").total, scoreRubric(vikram, "PM").band], [20, "Decline"]);
  assert.deepEqual([scoreRubric(preetham, "PM").total, scoreRubric(preetham, "PM").band], [37, "Decline"]);
  assert.deepEqual([scoreRubric(rahul, "PM").total, scoreRubric(rahul, "PM").band], [10, "Decline"]);
});

test("PM-level 3 counts as 2 on SPM unless the SPM bar is met", () => {
  assert.equal(toSpmLevel(3, false), 2);
  assert.equal(toSpmLevel(3, true), 3);
  assert.equal(toSpmLevel(2, true), 2);
});

test("Spike rule: a 3 on A or B guarantees at least a second look", () => {
  const a = make({ A: [3], B: [0], C: [0], D: [0] }); // 30
  const r = scoreRubric(a, "PM");
  assert.equal(r.baseBand, "Decline");
  assert.equal(r.band, "Second look");
  assert.deepEqual(r.overrides, ["Spike"]);
});

test("Unclear rule: two '?' marks means a second look", () => {
  const a = make({ A: [1, false, true], B: [1, false, true], C: [0], D: [0] });
  const r = scoreRubric(a, "PM");
  assert.equal(r.band, "Second look");
  assert.ok(r.overrides.includes("Unclear"));
});

test("Cross-route: SPM applicant missing SPM shortlist but PM >= 65 goes to PM shortlist", () => {
  // PM: 30 + 30 + 25*(2/3) + 0 = 77 ; SPM: A,B -> 2 => 25*(2/3)+30*(2/3)+30*(2/3) = 57
  const a = make({ A: [3], B: [3], C: [2], D: [0] });
  const ev = evaluate(a, "SPM");
  assert.equal(ev.listRole, "PM");
  assert.equal(ev.band, "Shortlist");
  assert.ok(ev.overrides.includes("Cross-route"));
});

test("Cross-route: PM applicant scoring >= 70 on SPM is flagged", () => {
  const a = make({ A: [3, true], B: [3, true], C: [3, true], D: [0] });
  const ev = evaluate(a, "PM");
  assert.equal(ev.listRole, "PM");
  assert.equal(ev.flaggedSpm, true);
});

test("Only knockout: explicitly not relocating", () => {
  const a = make({ A: [3], B: [3], C: [3], D: [3] }, "not_willing");
  assert.equal(evaluate(a, "PM").band, "Decline");
  const unknown = make({ A: [3], B: [3], C: [3], D: [3] }, "unknown");
  assert.equal(evaluate(unknown, "PM").band, "Shortlist");
  assert.ok(standardProbes(unknown, "PM").some((p) => p.criterion === "Location"));
});

const CV = `Managed end-to-end import/export documentation for 180+ shipments monthly — Bills of Lading,
Shipping Bills, and customs clearance coordination. Coordinated daily with shipping lines.`;

test("Evidence must appear in the CV", () => {
  assert.equal(evidenceInCv("documentation for 180+ shipments monthly", CV), true);
  assert.equal(evidenceInCv("Managed end-to-end import/export documentation for 180+ shipments monthly - Bills of Lading", CV), true);
  assert.equal(evidenceInCv("Led a team of 40 warehouse staff across three cities", CV), false);
});

test("Unverifiable evidence becomes a '?' 1; '?' is never a 0", () => {
  const fake = finalizeCriterion(
    { pm_level: 3, spm_bar_met: true, unclear: false, evidence: "Led a team of 40 warehouse staff across three cities", rationale: "" },
    CV,
  );
  assert.deepEqual([fake.pm, fake.unclear, fake.verified], [1, true, false]);
  const vague = finalizeCriterion({ pm_level: 0, spm_bar_met: false, unclear: true, evidence: "", rationale: "" }, CV);
  assert.equal(vague.pm, 1);
  const real = finalizeCriterion(
    { pm_level: 3, spm_bar_met: false, unclear: false, evidence: "180+ shipments monthly", rationale: "" },
    CV,
  );
  assert.deepEqual([real.pm, real.spm, real.verified], [3, 2, true]);
});
