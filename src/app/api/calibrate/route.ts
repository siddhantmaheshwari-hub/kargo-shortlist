import { NextResponse } from "next/server";
import { calibrateHires } from "@/lib/pipeline";

export const maxDuration = 300;

export async function POST() {
  try {
    const hires = await calibrateHires();
    return NextResponse.json({ count: hires.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
