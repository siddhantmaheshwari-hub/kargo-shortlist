// Loads the 8 past-hire CVs from hires/ into Supabase with their performance outcomes.
// Run: npm run seed
import { readdirSync } from "node:fs";
import { join } from "node:path";
import mammoth from "mammoth";
import { createClient } from "@supabase/supabase-js";

// Outcomes from the rubric's calibration notes. "Thriving" = rated Exceeds Expectations.
const OUTCOMES: Record<string, { name: string; rating: "Exceeds" | "Meets" | "Below"; hadPmTitle: boolean }> = {
  cv_01_rohan_desai: { name: "Rohan Desai", rating: "Exceeds", hadPmTitle: false },
  cv_02_sunita_krishnamurthy: { name: "Sunita Krishnamurthy", rating: "Exceeds", hadPmTitle: false },
  cv_03_vikram_nair: { name: "Vikram Nair", rating: "Meets", hadPmTitle: true },
  cv_04_aditya_shetty: { name: "Aditya Shetty", rating: "Exceeds", hadPmTitle: false },
  cv_05_preetham_rao: { name: "Preetham Rao", rating: "Below", hadPmTitle: false },
  cv_06_meghna_tiwari: { name: "Meghna Tiwari", rating: "Exceeds", hadPmTitle: false },
  cv_07_lavanya_iyer: { name: "Lavanya Iyer", rating: "Exceeds", hadPmTitle: true },
  cv_08_rahul_bose: { name: "Rahul Bose", rating: "Meets", hadPmTitle: false },
};

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const dir = join(process.cwd(), "hires");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".docx"))) {
    const meta = OUTCOMES[file.replace(/\.docx$/, "")];
    if (!meta) {
      console.warn(`Skipping ${file}: no outcome recorded`);
      continue;
    }
    const { value } = await mammoth.extractRawText({ path: join(dir, file) });
    const { error } = await db.from("past_hires").upsert(
      {
        name: meta.name,
        file_name: file,
        rating: meta.rating,
        thriving: meta.rating === "Exceeds",
        had_pm_title: meta.hadPmTitle,
        cv_text: value.replace(/\n{3,}/g, "\n\n").trim(),
      },
      { onConflict: "name" },
    );
    if (error) throw new Error(`${file}: ${error.message}`);
    console.log(`Seeded ${meta.name} (${meta.rating})`);
  }
  console.log("Done. Open /pattern and click 'Run calibration' to score them.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
