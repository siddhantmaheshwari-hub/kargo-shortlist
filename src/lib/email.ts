import "server-only";
import { Resend } from "resend";
import { env } from "./env";
import { generateJson } from "./gemini";
import { check, db } from "./supabase";
import { CRITERIA, levelsFor } from "./rubric";
import type { CandidateRow, EmailRow, Role } from "./types";

const ROLE_TITLE: Record<Role, string> = { PM: "Product Manager", SPM: "Senior Product Manager" };

function roleFor(c: CandidateRow): Role {
  return c.list_role ?? c.role_applied;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}

function signature(): string {
  return `${env.founderName()}\nFounder, ${env.companyName()}`;
}

/** The single most concrete, genuine thing from their CV, for a personal line. */
function strongestEvidence(c: CandidateRow): string | null {
  if (!c.assessment) return null;
  const levels = levelsFor(c.assessment, roleFor(c));
  const best = [...CRITERIA]
    .filter(({ key }) => c.assessment!.criteria[key].verified && c.assessment!.criteria[key].evidence)
    .sort((x, y) => levels[y.key] - levels[x.key])[0];
  return best ? c.assessment.criteria[best.key].evidence : null;
}

function templateEmail(c: CandidateRow, kind: "invite" | "rejection"): { subject: string; body: string } {
  const role = ROLE_TITLE[roleFor(c)];
  const name = firstName(c.name);
  const company = env.companyName();
  if (kind === "invite") {
    const link = env.schedulingLink();
    return {
      subject: `${company}: next step for the ${role} role`,
      body: [
        `Hi ${name},`,
        `Thank you for applying for the ${role} role at ${company}. I've read your CV and I'd like to talk.`,
        `The conversation will be about 45 minutes. I'll mostly ask about specific situations from your work: operations you've been close to, things you built that others picked up, and times something broke on your watch.`,
        link
          ? `You can pick a time that suits you here: ${link}`
          : `Could you reply with two or three times that work for you over the next week?`,
        `Looking forward to it.`,
        signature(),
      ].join("\n\n"),
    };
  }
  return {
    subject: `Your application for ${role} at ${company}`,
    body: [
      `Hi ${name},`,
      `Thank you for applying for the ${role} role at ${company}, and for the time you put into it.`,
      `I've reviewed your application carefully, and I've decided not to move forward with it for this role. This isn't a judgment on your ability. It reflects the specific profile we need right now.`,
      `I'm grateful you considered ${company}, and I wish you the very best with your search.`,
      signature(),
    ].join("\n\n"),
  };
}

const SYSTEM = `
You write short emails from Arjun Mehta, founder of Kargo (Mumbai logistics SaaS), to job candidates.
Warm, direct, plain English, no corporate filler, no exclamation marks. 90-160 words in the body.
Never mention scores, rubrics, bands, rankings, AI, or other candidates. Never promise anything
you weren't told. Sign off exactly with the provided signature.

INVITE: invite them to a ~45 minute conversation for the named role. You may reference ONE concrete
thing from their background (provided) that made you want to talk. Ask for times, or give the
scheduling link if provided.

REJECTION: respectful and clear that we are not moving forward for this role. Thank them. You may
acknowledge ONE genuine thing from their background (provided) in a single sentence. Do not give
reasons that could read as critique, and do not suggest they reapply unless told to.
`.trim();

const SCHEMA = {
  type: "object",
  properties: { subject: { type: "string" }, body: { type: "string" } },
  required: ["subject", "body"],
};

export async function draftEmail(c: CandidateRow, kind: "invite" | "rejection"): Promise<{ subject: string; body: string }> {
  const fallback = templateEmail(c, kind);
  try {
    const evidence = strongestEvidence(c);
    const res = await generateJson<{ subject: string; body: string }>({
      system: SYSTEM,
      prompt: [
        `Type: ${kind.toUpperCase()}`,
        `Candidate first name: ${firstName(c.name)}`,
        `Role: ${ROLE_TITLE[roleFor(c)]}`,
        `Something concrete from their CV: ${evidence ?? "(none; keep it general)"}`,
        kind === "invite" ? `Scheduling link: ${env.schedulingLink() || "(none; ask them to reply with times)"}` : "",
        `Signature:\n${signature()}`,
      ]
        .filter(Boolean)
        .join("\n"),
      schema: SCHEMA,
      temperature: 0.4,
    });
    if (!res.subject?.trim() || !res.body?.trim()) return fallback;
    return { subject: res.subject.trim(), body: res.body.trim() };
  } catch {
    return fallback;
  }
}

export function emailSendingEnabled(): boolean {
  return Boolean(env.resendKey());
}

/**
 * Send one email through Resend. Without RESEND_API_KEY it stays a draft.
 * With TEST_RECIPIENT_EMAIL set, it goes to that address instead of the candidate.
 */
export async function sendEmail(emailId: string): Promise<EmailRow> {
  const email = check(await db().from("emails").select("*").eq("id", emailId).single()) as EmailRow;
  if (email.status === "sent") return email;

  if (!emailSendingEnabled()) {
    return check(
      await db()
        .from("emails")
        .update({ status: "draft", error: "Saved as draft: RESEND_API_KEY is not set yet." })
        .eq("id", emailId)
        .select("*")
        .single(),
    ) as EmailRow;
  }

  const testTo = env.testRecipient();
  const to = testTo || email.to_email;
  if (!to) {
    return check(
      await db()
        .from("emails")
        .update({ status: "draft", error: "No email address found on the CV. Add one to send." })
        .eq("id", emailId)
        .select("*")
        .single(),
    ) as EmailRow;
  }

  const resend = new Resend(env.resendKey());
  const subject = testTo ? `[test → ${email.to_email ?? "no address"}] ${email.subject}` : email.subject;
  const { data, error } = await resend.emails.send({
    from: env.resendFrom(),
    to,
    subject,
    text: email.body,
  });

  const update = error
    ? { status: "failed", error: error.message }
    : { status: "sent", error: null, provider_id: data?.id ?? null, sent_at: new Date().toISOString() };
  return check(await db().from("emails").update(update).eq("id", emailId).select("*").single()) as EmailRow;
}
