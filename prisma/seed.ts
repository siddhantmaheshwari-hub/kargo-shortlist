import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";

const db = new PrismaClient();
const ROOT = process.cwd();

async function readDocx(file: string): Promise<string> {
  if (!fs.existsSync(file)) {
    console.warn(`  ! missing ${path.relative(ROOT, file)} — seeding with empty text`);
    return "";
  }
  const { value } = await mammoth.extractRawText({ path: file });
  return value.trim();
}

// Both roles have been open since July (Section 0.2).
const ROLES = [
  { code: "PM", title: "Product Manager", jd: "jds/MESA_Kargo_JD_Product_Manager.docx" },
  { code: "SPM", title: "Senior Product Manager", jd: "jds/MESA_Kargo_JD_Senior_Product_Manager.docx" },
];
const ROLES_OPENED_AT = new Date("2026-07-13T00:00:00+05:30");

// Exactly the Section 0.4 table.
const PAST_HIRES = [
  { name: "Rohan Desai", roleHired: "Head of Engineering", joinedAt: "2022-07-01", rating: "EXCEEDS", file: "cv_01_rohan_desai.docx" },
  { name: "Sunita Krishnamurthy", roleHired: "Operations Lead", joinedAt: "2023-01-01", rating: "EXCEEDS", file: "cv_02_sunita_krishnamurthy.docx" },
  { name: "Vikram Nair", roleHired: "Product Manager", joinedAt: "2023-06-01", rating: "MEETS", file: "cv_03_vikram_nair.docx" },
  { name: "Aditya Shetty", roleHired: "Sales Lead", joinedAt: "2023-08-01", rating: "EXCEEDS", file: "cv_04_aditya_shetty.docx" },
  { name: "Preetham Rao", roleHired: "Backend Engineer", joinedAt: "2024-02-01", rating: "BELOW", file: "cv_05_preetham_rao.docx" },
  { name: "Meghna Tiwari", roleHired: "Customer Success Manager", joinedAt: "2024-08-01", rating: "EXCEEDS", file: "cv_06_meghna_tiwari.docx" },
  { name: "Lavanya Iyer", roleHired: "Product Manager", joinedAt: "2025-04-01", rating: "EXCEEDS", file: "cv_07_lavanya_iyer.docx" },
  { name: "Rahul Bose", roleHired: "Growth & Marketing Lead", joinedAt: "2025-06-01", rating: "MEETS", file: "cv_08_rahul_bose.docx" },
];

async function main() {
  console.log("Seeding roles…");
  for (const r of ROLES) {
    const jdText = await readDocx(path.join(ROOT, r.jd));
    await db.role.upsert({
      where: { code: r.code },
      update: { title: r.title, jdText },
      create: { code: r.code, title: r.title, jdText, openedAt: ROLES_OPENED_AT },
    });
    console.log(`  ${r.code}: ${jdText.length} chars of JD`);
  }

  console.log("Seeding past hires…");
  for (const h of PAST_HIRES) {
    const cvText = await readDocx(path.join(ROOT, "hires", h.file));
    const data = { roleHired: h.roleHired, joinedAt: new Date(h.joinedAt), rating: h.rating, cvText };
    await db.pastHire.upsert({ where: { name: h.name }, update: data, create: { name: h.name, ...data } });
    console.log(`  ${h.name} (${h.rating}): ${cvText.length} chars of CV`);
  }

  await db.auditLog.create({
    data: {
      actor: "system",
      action: "seed",
      entity: "database",
      detail: JSON.stringify({ roles: ROLES.length, pastHires: PAST_HIRES.length }),
    },
  });

  console.log(`Done: ${await db.role.count()} roles, ${await db.pastHire.count()} past hires.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
