import { NextResponse } from "next/server";
import { emailSendingEnabled, testRecipient } from "@/lib/email";
import { decideMany } from "@/lib/pipeline";

export const maxDuration = 120;

// Bulk Advance / Pass. Emails are drafted here; the client reviews them before sending.
export async function POST(req: Request) {
  try {
    const { ids, decision } = await req.json();
    if (decision !== "advance" && decision !== "pass") {
      return NextResponse.json({ error: "decision must be advance or pass" }, { status: 400 });
    }
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || !ids.every((i) => typeof i === "string")) {
      return NextResponse.json({ error: "ids must be a list of 1–100 candidate ids" }, { status: 400 });
    }
    return NextResponse.json({ results: await decideMany(ids, decision), sendingEnabled: emailSendingEnabled(), testRecipient: testRecipient() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
