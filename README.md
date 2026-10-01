# Kargo Shortlist

Ranks Product Manager and Senior PM candidates for Kargo against the pattern Kargo's best past hires
share, instead of against the JD. For each candidate it writes a brief (who they are, why they ranked
there, what to probe). Arjun clicks **Advance to interview** or **Reject**, reviews the invite or rejection email, and it is
sent.

Stack: Next.js 16 (App Router) · Supabase (Postgres) · Gemini · Resend · Vercel.

## How the ranking works

The pattern is `rubric.txt` (Kargo CV Scoring Rubric v2), learned from the 8 past hires in `hires/`:

| | Criterion | PM | SPM |
|---|---|---|---|
| A | Hands-on operations exposure | 30% | 25% |
| B | Unprompted fix, adopted by others | 30% | 30% |
| C | Resolves live breakdowns personally | 25% | 30% |
| D | Absorbs extra load without asking for more people | 15% | 15% |

1. **Gemini reads the CV** and proposes a 0–3 level per criterion, a verbatim evidence quote, and an
   "unclear" (?) flag (`src/lib/assess.ts`).
2. **Code enforces the rubric** (`src/lib/evidence.ts`, `src/lib/rubric.ts`):
   - Evidence the CV doesn't actually contain is downgraded to a "?" 1. A "?" is always a 1, never a 0.
   - SPM levels are derived from PM levels (a PM-level 3 is an SPM 2 unless the SPM bar is met).
   - Totals, bands, and the Spike / Unclear / Cross-route overrides are computed deterministically.
   - The only knockout is a CV that explicitly rules out Mumbai. If the CV doesn't say, the brief adds a relocation probe.
   - Titles, years, degrees, companies and tools are never scored.
3. **Ranking:** band, then total, then number of 3s. Cross-routed SPM applicants appear on the PM list.
4. **Brief:** Gemini explains the computed scores (it can't change them). The rubric's standard probes
   are always added for any 1 or "?".
5. **Calibration** (`/pattern`): the 8 past hires go through the same scorer, to check that thriving
   hires (Exceeds) separate from Meets/Below.

`npm test` runs the rubric maths against the calibration table in `rubric.txt`.

## Emails

Clicking Advance to interview or Reject drafts the email (Gemini, with a template fallback) and opens it
for review: edit it, then Send, Save as draft, or Cancel the decision. **With `RESEND_API_KEY` blank, every email is saved as a draft** in `/outbox`.
Once you add the key, use "Send unsent" there. Set `TEST_RECIPIENT_EMAIL` to redirect all mail to
yourself while testing. Resend's `onboarding@resend.dev` sender can only deliver to your own Resend
account address, so verify a domain before emailing real candidates.

## Setup

1. Create a Supabase project and run `supabase/schema.sql` in its SQL editor. RLS is on with no
   public policies, so only the server (service role key) can read candidate data.
2. `cp .env.example .env` and fill in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`.
3. `npm install`
4. `npm run seed` loads the past hires from `hires/`.
5. `npm run dev`, open `/pattern` and click **Run calibration**.
6. Add CVs at `/upload` (.docx, .pdf, .txt, or pasted text).

## Deploying to Vercel

Add the same env vars in the Vercel project, plus **`APP_PASSWORD`**. The app is behind HTTP basic
auth (any username, that password), because it holds candidate CVs and can send email. A production
deployment without `APP_PASSWORD` refuses all requests.

## Pages

- `/`: both roles at a glance
- `/roles/pm`, `/roles/spm`: ranked lists with Advance / Pass
- `/candidates/[id]`: brief, scorecard with CV evidence, email
- `/upload`: add CVs
- `/pattern`: the success pattern and calibration against past hires
- `/outbox`: every drafted and sent email
