import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return v;
}

export const env = {
  supabaseUrl: () => required("SUPABASE_URL"),
  supabaseServiceKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  geminiKey: () => required("GEMINI_API_KEY"),
  geminiModel: () => process.env.GEMINI_MODEL || "gemini-3.8-flash",
  resendKey: () => process.env.RESEND_API_KEY || "",
  resendFrom: () => process.env.RESEND_FROM_EMAIL || "Kargo Hiring <onboarding@resend.dev>",
  // When set, every email is redirected here instead of the candidate (safe testing).
  testRecipient: () => process.env.TEST_RECIPIENT_EMAIL || "",
  schedulingLink: () => process.env.SCHEDULING_LINK || "",
  founderName: () => process.env.FOUNDER_NAME || "Arjun Mehta",
  companyName: () => process.env.COMPANY_NAME || "Kargo",
};
