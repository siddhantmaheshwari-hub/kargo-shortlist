import "server-only";
import mammoth from "mammoth";
import { extractText } from "unpdf";

/** Plain text from an uploaded CV (.docx, .pdf, .txt/.md). */
export async function cvTextFromFile(fileName: string, bytes: ArrayBuffer): Promise<string> {
  const lower = fileName.toLowerCase();
  let text: string;
  if (lower.endsWith(".docx")) {
    const res = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    text = res.value;
  } else if (lower.endsWith(".pdf")) {
    const res = await extractText(new Uint8Array(bytes), { mergePages: true });
    text = res.text;
  } else if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    text = new TextDecoder().decode(bytes);
  } else {
    throw new Error("Unsupported file type. Upload .docx, .pdf or .txt.");
  }
  text = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 200) throw new Error("Could not read enough text from this file (is it a scanned image?).");
  return text;
}
