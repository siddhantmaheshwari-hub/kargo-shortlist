import "server-only";
import { createHash } from "node:crypto";
import { assessCv, findEmail } from "./assess";
import { writeBrief } from "./brief";
import { draftEmail } from "./email";
import { evaluate } from "./rubric";
import { check, db } from "./supabase";
import type { CandidateRow, EmailRow, PastHireRow, Role } from "./types";

export function cvHash(text: string): string {
  return createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex");
}

/** Score + brief a candidate row that already has cv_text. */
export async function scoreCandidate(id: string): Promise<CandidateRow> {
  const c = check(await db().from("candidates").select("*").eq("id", id).single()) as CandidateRow;
  try {
    const { name, email, assessment } = await assessCv(c.cv_text);
    const ev = evaluate(assessment, c.role_applied);
    const brief = await writeBrief(c.cv_text, assessment, ev, c.role_applied);
    return check(
      await db()
        .from("candidates")
        .update({
          name,
          email: email ?? c.email,
          location: assessment.location,
          relocation: assessment.relocation,
          assessment,
          pm_total: ev.pm.total,
          spm_total: ev.spm.total,
          list_role: ev.listRole,
          band: ev.band,
          total: ev.total,
          overrides: ev.overrides,
          unclear_count: ev.unclearCount,
          flagged_spm: ev.flaggedSpm,
          brief,
          status: "scored",
          error: null,
        })
        .eq("id", id)
        .select("*")
        .single(),
    ) as CandidateRow;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db().from("candidates").update({ status: "error", error: message }).eq("id", id);
    throw e;
  }
}

/** Insert a new CV and score it. Re-uploading the same CV for the same role returns the existing row. */
export async function ingestCv(opts: { cvText: string; fileName: string; role: Role }): Promise<{
  candidate: CandidateRow;
  duplicate: boolean;
}> {
  const hash = cvHash(opts.cvText);
  const existing = check(
    await db().from("candidates").select("*").eq("role_applied", opts.role).eq("cv_hash", hash).maybeSingle(),
  ) as CandidateRow | null;
  if (existing && existing.status === "scored") return { candidate: existing, duplicate: true };

  const row =
    existing ??
    (check(
      await db()
        .from("candidates")
        .insert({
          name: opts.fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
          email: findEmail(opts.cvText),
          role_applied: opts.role,
          file_name: opts.fileName,
          cv_text: opts.cvText,
          cv_hash: hash,
          status: "processing",
        })
        .select("*")
        .single(),
    ) as CandidateRow);

  return { candidate: await scoreCandidate(row.id), duplicate: false };
}

/** Record Advance/Pass and draft the matching email. Sending happens after the undo window. */
export async function decide(id: string, decision: "advance" | "pass"): Promise<EmailRow> {
  const c = check(await db().from("candidates").select("*").eq("id", id).single()) as CandidateRow;
  if (c.status !== "scored") throw new Error("Candidate has not been scored yet.");

  const existing = check(
    await db().from("emails").select("*").eq("candidate_id", id).maybeSingle(),
  ) as EmailRow | null;
  if (existing?.status === "sent") throw new Error("An email has already been sent to this candidate.");

  const kind = decision === "advance" ? "invite" : "rejection";
  const { subject, body } = await draftEmail(c, kind);

  check(
    await db()
      .from("candidates")
      .update({ decision, decided_at: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .single(),
  );
  return check(
    await db()
      .from("emails")
      .upsert(
        { candidate_id: id, kind, to_email: c.email, subject, body, status: "draft", error: null, provider_id: null },
        { onConflict: "candidate_id" },
      )
      .select("*")
      .single(),
  ) as EmailRow;
}

/** Undo a decision while its email is still unsent. */
export async function undoDecision(id: string): Promise<void> {
  const email = check(
    await db().from("emails").select("*").eq("candidate_id", id).maybeSingle(),
  ) as EmailRow | null;
  if (email?.status === "sent") throw new Error("The email has already been sent, so this can't be undone.");
  if (email) check(await db().from("emails").delete().eq("id", email.id).select("id"));
  check(await db().from("candidates").update({ decision: null, decided_at: null }).eq("id", id).select("id"));
}

/** Score every past hire with the same scorer, to check the rubric separates thriving hires. */
export async function calibrateHires(): Promise<PastHireRow[]> {
  const hires = check(await db().from("past_hires").select("*").order("name")) as PastHireRow[];
  return Promise.all(
    hires.map(async (h) => {
      const { assessment } = await assessCv(h.cv_text);
      const ev = evaluate(assessment, "PM");
      return check(
        await db()
          .from("past_hires")
          .update({
            assessment,
            pm_total: ev.pm.total,
            spm_total: ev.spm.total,
            calibrated_at: new Date().toISOString(),
          })
          .eq("id", h.id)
          .select("*")
          .single(),
      ) as PastHireRow;
    }),
  );
}
