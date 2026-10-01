import { NextResponse } from "next/server";
import { emailSendingEnabled, testRecipient } from "@/lib/email";
import { check, db } from "@/lib/supabase";

// The drafted email for a candidate, so it can be reopened for review.
export async function GET(_req: Request, ctx: RouteContext<"/api/candidates/[id]/email">) {
  const { id } = await ctx.params;
  try {
    const email = check(await db().from("emails").select("*").eq("candidate_id", id).maybeSingle());
    if (!email) return NextResponse.json({ error: "No email drafted for this candidate yet." }, { status: 404 });
    return NextResponse.json({ email, sendingEnabled: emailSendingEnabled(), testRecipient: testRecipient() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
