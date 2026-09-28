-- Kargo Shortlist schema. Run once in the Supabase SQL editor.
-- RLS is ON with no policies: the anon key can read nothing. The Next.js server
-- connects with SUPABASE_SERVICE_ROLE_KEY (server-only, never NEXT_PUBLIC_).

create extension if not exists pgcrypto;

-- Past hires: the calibration set the success pattern is learned from.
create table if not exists past_hires (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  file_name     text not null,
  rating        text not null check (rating in ('Exceeds', 'Meets', 'Below')),
  thriving      boolean not null,
  had_pm_title  boolean not null,
  cv_text       text not null,
  assessment    jsonb,          -- same shape as candidates.assessment
  pm_total      int,
  spm_total     int,
  calibrated_at timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists candidates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text,
  location      text,
  relocation    text check (relocation in ('mumbai', 'willing', 'unknown', 'not_willing')),
  role_applied  text not null check (role_applied in ('PM', 'SPM')),
  file_name     text,
  cv_text       text not null,
  cv_hash       text not null,
  status        text not null default 'processing' check (status in ('processing', 'scored', 'error')),
  error         text,

  -- Scoring (computed deterministically from assessment by src/lib/rubric.ts)
  assessment    jsonb,          -- per-criterion levels + CV evidence from Gemini, verified in code
  pm_total      int,
  spm_total     int,
  list_role     text check (list_role in ('PM', 'SPM')),   -- which ranked list they appear on
  band          text check (band in ('Shortlist', 'Second look', 'Decline')),
  total         int,            -- total on the list_role rubric
  overrides     text[] not null default '{}',
  unclear_count int not null default 0,
  flagged_spm   boolean not null default false,             -- PM applicant scoring >= 70 on SPM

  brief         jsonb,

  decision      text check (decision in ('advance', 'pass')),
  decided_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique (role_applied, cv_hash)
);

create index if not exists candidates_list_idx on candidates (list_role, band, total desc);

create table if not exists emails (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null unique references candidates(id) on delete cascade,
  kind          text not null check (kind in ('invite', 'rejection')),
  to_email      text,
  subject       text not null,
  body          text not null,
  status        text not null default 'draft' check (status in ('draft', 'sent', 'failed')),
  provider_id   text,
  error         text,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);

alter table past_hires enable row level security;
alter table candidates enable row level security;
alter table emails     enable row level security;
