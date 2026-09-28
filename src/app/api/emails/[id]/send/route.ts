import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export async function POST(_req: Request, ctx: RouteContext<"/api/emails/[id]/send">) {
  const { id } = await ctx.params;
  try {
    const email = await sendEmail(id);
    return NextResponse.json({ status: email.status, error: email.error });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
