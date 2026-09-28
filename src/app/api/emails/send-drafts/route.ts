import { NextResponse } from "next/server";
import { emailSendingEnabled, sendEmail } from "@/lib/email";
import { check, db } from "@/lib/supabase";

export const maxDuration = 120;

// Sends every saved draft (e.g. the ones queued before RESEND_API_KEY was added).
export async function POST() {
  if (!emailSendingEnabled()) {
    return NextResponse.json({ error: "RESEND_API_KEY is not set." }, { status: 400 });
  }
  const drafts = check(
    await db().from("emails").select("id").in("status", ["draft", "failed"]),
  ) as { id: string }[];
  const results = [];
  for (const d of drafts) {
    const e = await sendEmail(d.id);
    results.push({ id: d.id, status: e.status, error: e.error });
  }
  return NextResponse.json({
    sent: results.filter((r) => r.status === "sent").length,
    notSent: results.filter((r) => r.status !== "sent").length,
    results,
  });
}
