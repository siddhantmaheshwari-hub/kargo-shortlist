import { NextResponse } from "next/server";
import { decide } from "@/lib/pipeline";

export const maxDuration = 60;

export async function POST(req: Request, ctx: RouteContext<"/api/candidates/[id]/decision">) {
  const { id } = await ctx.params;
  try {
    const { decision, note } = await req.json();
    if (decision !== "advance" && decision !== "pass") {
      return NextResponse.json({ error: "decision must be advance or pass" }, { status: 400 });
    }
    const email = await decide(id, decision, typeof note === "string" ? note : undefined);
    return NextResponse.json({ emailId: email.id, subject: email.subject, toEmail: email.to_email });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
