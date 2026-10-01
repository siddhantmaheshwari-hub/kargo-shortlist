import { NextResponse } from "next/server";
import { updateEmailContent } from "@/lib/email";

// Save edits to a draft without sending it.
export async function POST(req: Request, ctx: RouteContext<"/api/emails/[id]">) {
  const { id } = await ctx.params;
  try {
    const email = await updateEmailContent(id, await req.json().catch(() => ({})));
    return NextResponse.json({ status: email.status });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
