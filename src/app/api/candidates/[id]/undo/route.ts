import { NextResponse } from "next/server";
import { undoDecision } from "@/lib/pipeline";

export async function POST(_req: Request, ctx: RouteContext<"/api/candidates/[id]/undo">) {
  const { id } = await ctx.params;
  try {
    await undoDecision(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 409 });
  }
}
