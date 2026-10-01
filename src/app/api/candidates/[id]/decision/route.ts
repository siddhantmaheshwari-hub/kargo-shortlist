import { NextResponse } from "next/server";
import { emailSendingEnabled } from "@/lib/email";
import { decide } from "@/lib/pipeline";

export const maxDuration = 60;

// Records Advance/Pass and drafts the email. Nothing is sent here: the client
// shows the draft for review, and sending is a separate, explicit step.
export async function POST(req: Request, ctx: RouteContext<"/api/candidates/[id]/decision">) {
  const { id } = await ctx.params;
  try {
    const { decision, note } = await req.json();
    if (decision !== "advance" && decision !== "pass") {
      return NextResponse.json({ error: "decision must be advance or pass" }, { status: 400 });
    }
    const email = await decide(id, decision, typeof note === "string" ? note : undefined);
    return NextResponse.json({ email, sendingEnabled: emailSendingEnabled() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
