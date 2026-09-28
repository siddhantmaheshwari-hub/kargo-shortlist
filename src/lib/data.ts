import "server-only";
import { connection } from "next/server";
import { rankCompare } from "./rubric";
import { check, db } from "./supabase";
import type { CandidateRow, EmailRow, PastHireRow, Role } from "./types";

// Everything here reads live data per request (never prerendered at build).

const LIST_COLUMNS =
  "id,name,email,location,relocation,role_applied,file_name,status,error,assessment,pm_total,spm_total,list_role,band,total,overrides,unclear_count,flagged_spm,brief,decision,decided_at,created_at";

export type ListCandidate = Omit<CandidateRow, "cv_text"> & { email_status: EmailRow["status"] | null };

async function withEmailStatus(rows: Omit<CandidateRow, "cv_text">[]): Promise<ListCandidate[]> {
  if (!rows.length) return [];
  const emails = check(
    await db().from("emails").select("candidate_id,status").in("candidate_id", rows.map((r) => r.id)),
  ) as { candidate_id: string; status: EmailRow["status"] }[];
  const byId = new Map(emails.map((e) => [e.candidate_id, e.status]));
  return rows.map((r) => ({ ...r, email_status: byId.get(r.id) ?? null }));
}

/** Ranked list for a role: everyone whose list_role is this role, best first. */
export async function rankedList(role: Role): Promise<{ ranked: ListCandidate[]; flaggedFromPm: ListCandidate[]; pending: ListCandidate[] }> {
  await connection();
  const rows = check(
    await db().from("candidates").select(LIST_COLUMNS).or(`list_role.eq.${role},and(list_role.is.null,role_applied.eq.${role})`),
  ) as Omit<CandidateRow, "cv_text">[];
  const all = await withEmailStatus(rows);
  const ranked = all.filter((c) => c.status === "scored").sort(rankCompare);
  const pending = all.filter((c) => c.status !== "scored");

  let flaggedFromPm: ListCandidate[] = [];
  if (role === "SPM") {
    const flagged = check(
      await db().from("candidates").select(LIST_COLUMNS).eq("flagged_spm", true).eq("status", "scored"),
    ) as Omit<CandidateRow, "cv_text">[];
    flaggedFromPm = await withEmailStatus(flagged);
  }
  return { ranked, flaggedFromPm, pending };
}

export async function getCandidate(id: string): Promise<{ candidate: CandidateRow; email: EmailRow | null; rank: number | null; listSize: number } | null> {
  await connection();
  const candidate = check(await db().from("candidates").select("*").eq("id", id).maybeSingle()) as CandidateRow | null;
  if (!candidate) return null;
  const email = check(await db().from("emails").select("*").eq("candidate_id", id).maybeSingle()) as EmailRow | null;

  let rank: number | null = null;
  let listSize = 0;
  if (candidate.status === "scored" && candidate.list_role) {
    const { ranked } = await rankedList(candidate.list_role);
    listSize = ranked.length;
    const i = ranked.findIndex((r) => r.id === id);
    rank = i >= 0 ? i + 1 : null;
  }
  return { candidate, email, rank, listSize };
}

export async function pastHires(): Promise<PastHireRow[]> {
  await connection();
  return check(await db().from("past_hires").select("*").order("rating").order("name")) as PastHireRow[];
}

export async function outbox(): Promise<(EmailRow & { candidate_name: string })[]> {
  await connection();
  const emails = check(await db().from("emails").select("*").order("created_at", { ascending: false })) as EmailRow[];
  if (!emails.length) return [];
  const names = check(
    await db().from("candidates").select("id,name").in("id", emails.map((e) => e.candidate_id)),
  ) as { id: string; name: string }[];
  const byId = new Map(names.map((n) => [n.id, n.name]));
  return emails.map((e) => ({ ...e, candidate_name: byId.get(e.candidate_id) ?? "Unknown" }));
}

export async function overview(): Promise<Record<Role, { total: number; shortlist: number; secondLook: number; decline: number; undecided: number }>> {
  await connection();
  const rows = check(
    await db().from("candidates").select("list_role,band,decision,status").eq("status", "scored"),
  ) as { list_role: Role; band: string; decision: string | null }[];
  const blank = () => ({ total: 0, shortlist: 0, secondLook: 0, decline: 0, undecided: 0 });
  const out: Record<Role, ReturnType<typeof blank>> = { PM: blank(), SPM: blank() };
  for (const r of rows) {
    const o = out[r.list_role];
    if (!o) continue;
    o.total++;
    if (r.band === "Shortlist") o.shortlist++;
    else if (r.band === "Second look") o.secondLook++;
    else o.decline++;
    if (!r.decision) o.undecided++;
  }
  return out;
}
