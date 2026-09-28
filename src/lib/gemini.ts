import "server-only";
import { GoogleGenAI } from "@google/genai";
import { env } from "./env";

let ai: GoogleGenAI | null = null;

function client(): GoogleGenAI {
  if (!ai) ai = new GoogleGenAI({ apiKey: env.geminiKey() });
  return ai;
}

/** Call Gemini and parse a JSON response that matches `schema`. Retries once on bad JSON. */
export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  schema: object;
  temperature?: number;
}): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await client().models.generateContent({
        model: env.geminiModel(),
        contents: opts.prompt,
        config: {
          systemInstruction: opts.system,
          temperature: opts.temperature ?? 0,
          responseMimeType: "application/json",
          responseJsonSchema: opts.schema,
        },
      });
      const text = res.text;
      if (!text) throw new Error("Gemini returned an empty response");
      return JSON.parse(text) as T;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Gemini call failed: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}
