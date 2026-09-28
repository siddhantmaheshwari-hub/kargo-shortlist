import { NextResponse } from "next/server";
import { scoreCandidate } from "@/lib/pipeline";

export const maxDuration = 120;

export async function POST(_req: Request, ctx: RouteContext<"/api/candidates/[id]/rescore">) {
  const { id } = await ctx.params;
  try {
    const c = await scoreCandidate(id);
    return NextResponse.json({ id: c.id, band: c.band, total: c.total });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
