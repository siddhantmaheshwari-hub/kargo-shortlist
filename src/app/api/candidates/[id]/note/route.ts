import { NextResponse } from "next/server";
import { setDecisionNote } from "@/lib/pipeline";

export async function POST(req: Request, ctx: RouteContext<"/api/candidates/[id]/note">) {
  const { id } = await ctx.params;
  const { note } = await req.json().catch(() => ({}));
  if (typeof note !== "string" || !note.trim()) {
    return NextResponse.json({ error: "note is required" }, { status: 400 });
  }
  const saved = await setDecisionNote(id, note.trim());
  if (!saved) {
    return NextResponse.json(
      { error: "Couldn't save the reason. Run supabase/migrations/002_decision_note.sql in Supabase." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
