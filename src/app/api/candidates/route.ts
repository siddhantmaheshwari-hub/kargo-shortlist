import { NextResponse } from "next/server";
import { cvTextFromFile } from "@/lib/extract";
import { ingestCv } from "@/lib/pipeline";
import type { Role } from "@/lib/types";

export const maxDuration = 120;

// One CV per request (the upload page sends files one by one so each stays within time limits).
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const role = form.get("role");
    if (role !== "PM" && role !== "SPM") {
      return NextResponse.json({ error: "role must be PM or SPM" }, { status: 400 });
    }
    const file = form.get("file");
    const pasted = form.get("text");

    let cvText: string;
    let fileName: string;
    if (file instanceof File && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "File is larger than 5 MB." }, { status: 400 });
      }
      fileName = file.name;
      cvText = await cvTextFromFile(file.name, await file.arrayBuffer());
    } else if (typeof pasted === "string" && pasted.trim().length >= 200) {
      fileName = "pasted-cv.txt";
      cvText = pasted.trim();
    } else {
      return NextResponse.json({ error: "Attach a CV file or paste at least 200 characters." }, { status: 400 });
    }

    const { candidate, duplicate } = await ingestCv({ cvText, fileName, role: role as Role });
    return NextResponse.json({
      id: candidate.id,
      name: candidate.name,
      band: candidate.band,
      total: candidate.total,
      listRole: candidate.list_role,
      duplicate,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
