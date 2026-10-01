import { NextResponse } from "next/server";
import { sendEmail, updateEmailContent } from "@/lib/email";

// Send one email, applying any last edits from the review step first.
export async function POST(req: Request, ctx: RouteContext<"/api/emails/[id]/send">) {
  const { id } = await ctx.params;
  try {
    const edits = await req.json().catch(() => ({}));
    if (edits && typeof edits === "object") await updateEmailContent(id, edits);
    const email = await sendEmail(id);
    return NextResponse.json({ status: email.status, error: email.error });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
