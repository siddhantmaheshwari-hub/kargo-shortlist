import "server-only";
import { connection } from "next/server";
import { rankCompare } from "./rubric";
import { check, db } from "./supabase";
import type { Band, CandidateRow, EmailRow, PastHireRow, Role } from "./types";

// Everything here reads live data per request (never prerendered at build).

export type ListCandidate = Omit<CandidateRow, "cv_text"> & { email_status: EmailRow["status"] | null };
export type HireSummary = Pick<PastHireRow, "name" | "rating" | "thriving" | "assessment">;

function stripCv(rows: CandidateRow[]): Omit<CandidateRow, "cv_text">[] {
  // select("*") (rather than a column list) keeps working before optional migrations are run.
  return rows.map((row) => {
    const rest: Omit<CandidateRow, "cv_text"> & { cv_text?: string } = { ...row };
    delete rest.cv_text;
    return { ...rest, decision_note: rest.decision_note ?? null };
  });
}

type EmailStatusRow = { candidate_id: string; status: EmailRow["status"] };

function withEmailStatus(rows: Omit<CandidateRow, "cv_text">[], emails: EmailStatusRow[]): ListCandidate[] {
  const byId = new Map(emails.map((e) => [e.candidate_id, e.status]));
  return rows.map((r) => ({ ...r, email_status: byId.get(r.id) ?? null }));
}

// The database is in another region from some deployments, so every page fetches
// what it needs in ONE parallel round of queries rather than one after another.
async function fetchWorkspaceData() {
  const [all, emails, hires] = await Promise.all([
    db().from("candidates").select("*").then((r) => check(r) as CandidateRow[]),
    db().from("emails").select("candidate_id,status").then((r) => check(r) as EmailStatusRow[]),
    db()
      .from("past_hires")
      .select("name,rating,thriving,assessment")
      .not("assessment", "is", null)
      .then((r) => check(r) as HireSummary[]),
  ]);
  return { all, emails, hires };
}

function buildWorkspace(role: Role, data: Awaited<ReturnType<typeof fetchWorkspaceData>>) {
  const { all, emails, hires } = data;
  const mine = all.filter((c) => (c.list_role ?? c.role_applied) === role);
  const rows = withEmailStatus(stripCv(mine), emails);
  const other: Role = role === "PM" ? "SPM" : "PM";
  return {
    ranked: rows.filter((c) => c.status === "scored").sort(rankCompare),
    pending: rows.filter((c) => c.status !== "scored"),
    flaggedForSpm: all.filter((c) => c.flagged_spm && c.status === "scored").length,
    otherRoleUndecided: all.filter((c) => (c.list_role ?? c.role_applied) === other && c.status === "scored" && !c.decision).length,
    hires,
  };
}

/** Everyone on a role's list, best first, plus the counts the workspace header needs. */
export async function workspace(role: Role): Promise<{
  ranked: ListCandidate[];
  pending: ListCandidate[];
  flaggedForSpm: number;
  otherRoleUndecided: number;
  hires: HireSummary[];
}> {
  await connection();
  return buildWorkspace(role, await fetchWorkspaceData());
}

export async function getCandidate(id: string): Promise<{
  candidate: CandidateRow;
  email: EmailRow | null;
  rank: number | null;
  listSize: number;
  hires: HireSummary[];
} | null> {
  await connection();
  const [data, email] = await Promise.all([
    fetchWorkspaceData(),
    db().from("emails").select("*").eq("candidate_id", id).maybeSingle().then((r) => check(r) as EmailRow | null),
  ]);
  const candidate = data.all.find((c) => c.id === id) ?? null;
  if (!candidate) return null;
  candidate.decision_note = candidate.decision_note ?? null;

  let rank: number | null = null;
  let listSize = 0;
  let hires: HireSummary[] = data.hires;
  if (candidate.status === "scored" && candidate.list_role) {
    const ws = buildWorkspace(candidate.list_role, data);
    listSize = ws.ranked.length;
    hires = ws.hires;
    const i = ws.ranked.findIndex((r) => r.id === id);
    rank = i >= 0 ? i + 1 : null;
  }
  return { candidate, email, rank, listSize, hires };
}

export async function pastHires(): Promise<PastHireRow[]> {
  await connection();
  return check(await db().from("past_hires").select("*").order("rating").order("name")) as PastHireRow[];
}

export async function outbox(): Promise<(EmailRow & { candidate_name: string })[]> {
  await connection();
  const [emails, names] = await Promise.all([
    db().from("emails").select("*").order("created_at", { ascending: false }).then((r) => check(r) as EmailRow[]),
    db().from("candidates").select("id,name").then((r) => check(r) as { id: string; name: string }[]),
  ]);
  if (!emails.length) return [];
  const byId = new Map(names.map((n) => [n.id, n.name]));
  return emails.map((e) => ({ ...e, candidate_name: byId.get(e.candidate_id) ?? "Unknown" }));
}

export interface RoleStats {
  total: number;
  shortlist: number;
  secondLook: number;
  decline: number;
  undecided: number;
  advanced: number;
  rejected: number;
  topUndecided: { id: string; name: string; band: Band | null; total: number | null } | null;
}

export interface ActivityItem {
  at: string;
  kind: "scored" | "advanced" | "passed" | "sent" | "draft" | "failed";
  candidateId: string;
  name: string;
  detail: string;
}

export async function overview(): Promise<{ stats: Record<Role, RoleStats>; activity: ActivityItem[]; calibrated: number }> {
  await connection();
  const [scored, emails, calibrated] = await Promise.all([
    db().from("candidates").select("*").eq("status", "scored").then((r) => check(r) as CandidateRow[]),
    db()
      .from("emails")
      .select("candidate_id,status,kind,sent_at,created_at")
      .then((r) => check(r) as Pick<EmailRow, "candidate_id" | "status" | "kind" | "sent_at" | "created_at">[]),
    db().from("past_hires").select("id").not("assessment", "is", null).then((r) => check(r) as { id: string }[]),
  ]);
  const rows = stripCv(scored);
  const blank = (): RoleStats => ({ total: 0, shortlist: 0, secondLook: 0, decline: 0, undecided: 0, advanced: 0, rejected: 0, topUndecided: null });
  const stats: Record<Role, RoleStats> = { PM: blank(), SPM: blank() };
  for (const role of ["PM", "SPM"] as Role[]) {
    const list = rows.filter((r) => r.list_role === role).sort(rankCompare);
    const s = stats[role];
    for (const r of list) {
      s.total++;
      if (r.band === "Shortlist") s.shortlist++;
      else if (r.band === "Second look") s.secondLook++;
      else s.decline++;
      if (!r.decision) s.undecided++;
      if (r.decision === "advance") s.advanced++;
      if (r.decision === "pass") s.rejected++;
    }
    const top = list.find((r) => !r.decision);
    s.topUndecided = top ? { id: top.id, name: top.name, band: top.band, total: top.total } : null;
  }

  const nameOf = new Map(rows.map((r) => [r.id, r.name]));
  const activity: ActivityItem[] = [];
  for (const r of rows) {
    activity.push({ at: r.created_at, kind: "scored", candidateId: r.id, name: r.name, detail: `${r.band} · ${r.total} on ${r.list_role}` });
    if (r.decision && r.decided_at) {
      activity.push({
        at: r.decided_at,
        kind: r.decision === "advance" ? "advanced" : "passed",
        candidateId: r.id,
        name: r.name,
        detail: `${r.decision === "advance" ? "Invited to interview" : "Rejected"}${r.decision_note ? ` · ${r.decision_note}` : ""}`,
      });
    }
  }
  for (const e of emails) {
    if (e.status === "sent" && e.sent_at) {
      activity.push({ at: e.sent_at, kind: "sent", candidateId: e.candidate_id, name: nameOf.get(e.candidate_id) ?? "Candidate", detail: e.kind === "invite" ? "Invite sent" : "Rejection sent" });
    }
  }
  activity.sort((a, b) => (a.at < b.at ? 1 : -1));

  return { stats, activity: activity.slice(0, 8), calibrated: calibrated.length };
}

