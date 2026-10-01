"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Columns3, Keyboard, Search, SlidersHorizontal, X } from "lucide-react";
import { Avatar, BandChip, CriterionBars } from "./ui";
import { CandidateProfile, type HireLite, type ProfileCandidate } from "./CandidateProfile";
import { useDecisions } from "./DecisionProvider";
import { CRITERIA, levelsFor } from "@/lib/rubric";
import { locationCheck, passReasons, redFlags } from "@/lib/signals";
import type { Band, Role } from "@/lib/types";

export type WorkspaceCandidate = ProfileCandidate & { created_at: string; status: string };

type Status = "todo" | "advance" | "pass" | "all";
type FlagKey = "relocation" | "unclear" | "moved" | "spm" | "noemail" | "unverified";
type Sort = "rank" | "score" | "newest";

const BANDS: Band[] = ["Shortlist", "Second look", "Decline"];
const FLAG_LABEL: Record<FlagKey, string> = {
  relocation: "Check relocation",
  unclear: "Unclear scores",
  unverified: "Claim not found",
  moved: "Moved between lists",
  spm: "Consider for SPM",
  noemail: "No email",
};

function hasFlag(c: WorkspaceCandidate, f: FlagKey): boolean {
  switch (f) {
    case "relocation":
      return c.assessment?.relocation === "unknown";
    case "unclear":
      return c.unclear_count > 0;
    case "unverified":
      return !!c.assessment && CRITERIA.some(({ key }) => c.assessment!.criteria[key].pm >= 1 && !c.assessment!.criteria[key].verified);
    case "moved":
      return !!c.list_role && c.list_role !== c.role_applied;
    case "spm":
      return c.flagged_spm;
    case "noemail":
      return !c.email;
  }
}

function Chip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition ${
        active ? "border-ink bg-ink text-white" : "border-line bg-surface-solid text-ink-2 hover:border-line-strong"
      }`}
    >
      {active && <Check className="size-3.5" />}
      {children}
      {count !== undefined && <span className={`tabular text-xs ${active ? "text-white/70" : "text-faint"}`}>{count}</span>}
    </button>
  );
}

export function Workspace({
  role,
  candidates,
  hires,
  flaggedForSpm,
}: {
  role: Role;
  candidates: WorkspaceCandidate[];
  hires: HireLite[];
  flaggedForSpm: number;
}) {
  const router = useRouter();
  const { decide, busyIds, reviewing } = useDecisions();
  const searchRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("todo");
  const [bands, setBands] = useState<Set<Band>>(new Set());
  const [flags, setFlags] = useState<Set<FlagKey>>(new Set());
  const [sort, setSort] = useState<Sort>("rank");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState<null | "advance" | "pass">(null);
  const lastIndex = useRef(0);

  const rankOf = useMemo(() => new Map(candidates.map((c, i) => [c.id, i + 1])), [candidates]);

  const statusCounts = useMemo(
    () => ({
      todo: candidates.filter((c) => !c.decision).length,
      advance: candidates.filter((c) => c.decision === "advance").length,
      pass: candidates.filter((c) => c.decision === "pass").length,
      all: candidates.length,
    }),
    [candidates],
  );

  const inStatus = useMemo(
    () => candidates.filter((c) => (status === "all" ? true : status === "todo" ? !c.decision : c.decision === status)),
    [candidates, status],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = inStatus.filter((c) => {
      if (bands.size && (!c.band || !bands.has(c.band))) return false;
      for (const f of flags) if (!hasFlag(c, f)) return false;
      if (q) {
        const hay = [
          c.name,
          c.location ?? "",
          c.email ?? "",
          c.brief?.who ?? "",
          ...(c.assessment ? CRITERIA.map(({ key }) => c.assessment!.criteria[key].evidence) : []),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sort === "score") list = [...list].sort((x, y) => (y.total ?? 0) - (x.total ?? 0));
    if (sort === "newest") list = [...list].sort((x, y) => (x.created_at < y.created_at ? 1 : -1));
    return list;
  }, [inStatus, bands, flags, query, sort]);

  // Keep a sensible selection: stay on the same person, or move to whoever took their place.
  const selected = visible.find((c) => c.id === selectedId) ?? visible[Math.min(lastIndex.current, visible.length - 1)] ?? null;
  useEffect(() => {
    if (selected) lastIndex.current = Math.max(0, visible.indexOf(selected));
  }, [selected, visible]);

  const move = useCallback(
    (delta: number) => {
      if (!visible.length) return;
      const i = selected ? visible.indexOf(selected) : -1;
      const next = visible[Math.max(0, Math.min(visible.length - 1, i + delta))];
      setSelectedId(next.id);
      document.getElementById(`row-${next.id}`)?.scrollIntoView({ block: "nearest" });
    },
    [visible, selected],
  );

  const decideOne = useCallback(
    (c: WorkspaceCandidate, d: "advance" | "pass") => {
      if (c.decision || busyIds.has(c.id)) return;
      const r = c.list_role ?? c.role_applied;
      void decide([c.id], d, { names: [c.name], reasons: d === "pass" ? passReasons(c.assessment, r, c.band) : undefined });
    },
    [decide, busyIds],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (reviewing) return;
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) {
        if (e.key === "Escape" && t === searchRef.current) searchRef.current?.blur();
        return;
      }
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        move(1);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "a" && selected) {
        decideOne(selected, "advance");
      } else if (e.key === "p" && selected) {
        decideOne(selected, "pass");
      } else if (e.key === "x" && selected) {
        toggleCheck(selected.id);
      } else if (e.key === "Escape") {
        setCompareOpen(false);
        setConfirmBulk(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, selected, decideOne, reviewing]);

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleIn<T>(set: Set<T>, v: T): Set<T> {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  }

  const filtersActive = bands.size + flags.size + (query ? 1 : 0);
  const checkedList = candidates.filter((c) => checked.has(c.id));
  const checkedUndecided = checkedList.filter((c) => !c.decision);
  const allVisibleChecked = visible.length > 0 && visible.every((c) => checked.has(c.id));

  async function runBulk(d: "advance" | "pass") {
    const ids = checkedUndecided.map((c) => c.id);
    setConfirmBulk(null);
    const ok = await decide(ids, d, { names: checkedUndecided.map((c) => c.name) });
    if (ok) setChecked(new Set());
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="card flex flex-col gap-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-sunk p-1" role="tablist" aria-label="Decision status">
            {(
              [
                ["todo", "To decide"],
                ["advance", "Advanced"],
                ["pass", "Passed"],
                ["all", "All"],
              ] as [Status, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={status === k}
                onClick={() => setStatus(k)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm transition ${
                  status === k ? "bg-surface-solid font-medium text-ink shadow-[0_1px_2px_rgb(19_35_34/0.08)]" : "text-muted hover:text-ink"
                }`}
              >
                {label}
                <span className="tabular text-xs text-faint">{statusCounts[k]}</span>
              </button>
            ))}
          </div>

          <label className="relative ml-auto min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, city, evidence…"
              aria-label="Search candidates"
              className="h-10 w-full rounded-full border border-line bg-surface-solid pr-9 pl-10 text-sm outline-none placeholder:text-faint focus:border-accent"
            />
            <kbd className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-line px-1.5 font-mono text-[10px] text-faint sm:block">/</kbd>
          </label>

          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm ${
              showFilters || filtersActive ? "border-ink text-ink" : "border-line text-ink-2"
            } bg-surface-solid hover:border-line-strong`}
          >
            <SlidersHorizontal className="size-4" />
            Filters
            {filtersActive > 0 && <span className="tabular flex size-5 items-center justify-center rounded-full bg-ink text-xs text-white">{filtersActive}</span>}
          </button>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Sort"
            className="h-10 rounded-full border border-line bg-surface-solid px-4 text-sm text-ink-2"
          >
            <option value="rank">Sort: Rank</option>
            <option value="score">Sort: Score</option>
            <option value="newest">Sort: Newest</option>
          </select>
        </div>

        {showFilters && (
          <div className="animate-rise space-y-3 border-t border-line pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 text-xs text-faint">Band</span>
              {BANDS.map((b) => (
                <Chip key={b} active={bands.has(b)} onClick={() => setBands(toggleIn(bands, b))} count={inStatus.filter((c) => c.band === b).length}>
                  {b}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 text-xs text-faint">Flags</span>
              {(Object.keys(FLAG_LABEL) as FlagKey[]).map((f) => {
                const count = inStatus.filter((c) => hasFlag(c, f)).length;
                if (!count && !flags.has(f)) return null;
                return (
                  <Chip key={f} active={flags.has(f)} onClick={() => setFlags(toggleIn(flags, f))} count={count}>
                    {FLAG_LABEL[f]}
                  </Chip>
                );
              })}
            </div>
          </div>
        )}

        {filtersActive > 0 && (
          <p className="flex flex-wrap items-center gap-2 px-1 text-sm text-muted">
            Showing <span className="tabular font-medium text-ink">{visible.length}</span> of {inStatus.length}
            <button
              onClick={() => {
                setBands(new Set());
                setFlags(new Set());
                setQuery("");
              }}
              className="text-accent hover:underline"
            >
              Clear filters
            </button>
          </p>
        )}
      </div>

      {role === "SPM" && flaggedForSpm > 0 && (
        <Link href="/roles/pm" className="card flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-white">
          <span>
            <span className="font-medium">{flaggedForSpm}</span> PM applicant{flaggedForSpm === 1 ? "" : "s"} also score 70+ on the SPM rubric
          </span>
          <span className="text-accent">Review on the PM list →</span>
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Ranked list */}
        <div className="card min-w-0 overflow-hidden p-0 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
          <div className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-line bg-surface-solid/95 px-4 text-xs text-faint backdrop-blur">
            <input
              type="checkbox"
              aria-label="Select all visible"
              checked={allVisibleChecked}
              onChange={() => setChecked(allVisibleChecked ? new Set() : new Set(visible.map((c) => c.id)))}
              className="size-4 accent-[var(--ink)]"
            />
            {checked.size > 0 ? (
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm text-ink">
                {confirmBulk ? (
                  <>
                    <span>
                      {confirmBulk === "pass" ? "Pass" : "Advance"} {checkedUndecided.length} and draft {checkedUndecided.length}{" "}
                      {confirmBulk === "pass" ? "rejection" : "invite"} email{checkedUndecided.length === 1 ? "" : "s"}?
                    </span>
                    <button onClick={() => runBulk(confirmBulk)} className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-white">
                      Confirm
                    </button>
                    <button onClick={() => setConfirmBulk(null)} className="text-xs text-muted hover:text-ink">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="tabular font-medium">{checked.size} selected</span>
                    <button
                      onClick={() => setCompareOpen(true)}
                      disabled={checked.size < 2 || checked.size > 3}
                      title={checked.size > 3 ? "Compare up to 3" : undefined}
                      className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs disabled:opacity-40"
                    >
                      <Columns3 className="size-3.5" /> Compare
                    </button>
                    {checkedUndecided.length > 0 && (
                      <>
                        <button onClick={() => setConfirmBulk("advance")} className="rounded-full border border-line px-3 py-1 text-xs">
                          Advance
                        </button>
                        <button onClick={() => setConfirmBulk("pass")} className="rounded-full border border-line px-3 py-1 text-xs">
                          Pass
                        </button>
                      </>
                    )}
                    <button onClick={() => setChecked(new Set())} aria-label="Clear selection" className="ml-auto text-muted hover:text-ink">
                      <X className="size-4" />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-between">
                <span>Ranked by band, then score</span>
                <span className="hidden items-center gap-1 xl:inline-flex" title="J/K move · A advance · P pass · X select · / search">
                  <Keyboard className="size-3.5" /> J K · A · P · X
                </span>
              </div>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="font-display text-lg">{candidates.length === 0 ? "No candidates yet" : status === "todo" && !filtersActive ? "All caught up" : "Nothing matches"}</p>
              <p className="mt-1 text-sm text-muted">
                {candidates.length === 0 ? (
                  <Link href="/upload" className="text-accent underline">
                    Add CVs to get a ranked shortlist
                  </Link>
                ) : status === "todo" && !filtersActive ? (
                  "Every candidate on this list has a decision."
                ) : (
                  "Try removing a filter."
                )}
              </p>
            </div>
          ) : (
            <ul role="listbox" aria-label="Candidates">
              {visible.map((c) => {
                const isSel = selected?.id === c.id;
                const r = c.list_role ?? c.role_applied;
                const loc = c.assessment ? locationCheck(c.assessment) : null;
                const warn = [
                  ...(loc && loc.tone !== "good" ? [loc] : []),
                  ...(c.assessment ? redFlags({ assessment: c.assessment, role: r, email: c.email, unclearCount: c.unclear_count }) : []),
                ];
                return (
                  <li
                    key={c.id}
                    id={`row-${c.id}`}
                    role="option"
                    aria-selected={isSel}
                    onClick={() => {
                      if (window.matchMedia("(min-width: 1024px)").matches) setSelectedId(c.id);
                      else router.push(`/candidates/${c.id}`);
                    }}
                    className={`group flex cursor-pointer items-center gap-3 border-b border-line px-4 py-3 transition last:border-0 ${
                      isSel ? "bg-accent-soft/60" : "hover:bg-white/70"
                    } ${busyIds.has(c.id) ? "opacity-60" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked.has(c.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleCheck(c.id)}
                      aria-label={`Select ${c.name}`}
                      className="size-4 accent-[var(--ink)]"
                    />
                    <span className="tabular w-5 text-right text-sm text-faint">{rankOf.get(c.id)}</span>
                    <Avatar name={c.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted">
                        {c.decision
                          ? c.decision === "advance"
                            ? "Advanced"
                            : "Passed"
                          : warn.length
                            ? warn.map((w) => w.label).join(" · ")
                            : c.location ?? (r !== c.role_applied ? `Moved from ${c.role_applied}` : "No flags")}
                        {c.flagged_spm ? " · Consider for SPM" : ""}
                      </p>
                    </div>
                    <span className="hidden sm:inline-flex">
                      <CriterionBars assessment={c.assessment} role={r} />
                    </span>
                    <div className="flex w-28 shrink-0 flex-col items-end gap-1">
                      <span className="tabular font-display text-lg leading-none font-medium">{c.total}</span>
                      <BandChip band={c.band} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Detail panel (desktop) */}
        <div className="hidden min-w-0 lg:block">
          {selected ? (
            <div key={selected.id} className="animate-rise">
              <CandidateProfile c={selected} hires={hires} rank={rankOf.get(selected.id)} listSize={candidates.length} />
            </div>
          ) : (
            <div className="card flex h-64 items-center justify-center text-sm text-muted">Select a candidate</div>
          )}
        </div>
      </div>

      {compareOpen && <Compare list={checkedList.slice(0, 3)} role={role} onClose={() => setCompareOpen(false)} />}
    </div>
  );
}

function Compare({ list, role, onClose }: { list: WorkspaceCandidate[]; role: Role; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/20 p-4 backdrop-blur-sm sm:p-8" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Compare candidates" className="card w-full max-w-5xl bg-surface-solid p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl font-medium">Compare side by side</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-sunk">
            <X className="size-5" />
          </button>
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }}>
          {list.map((c) => {
            const r = c.list_role ?? c.role_applied;
            const levels = c.assessment ? levelsFor(c.assessment, r) : null;
            return (
              <div key={c.id} className="min-w-0 space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar name={c.name} size={44} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="tabular font-display text-lg font-medium">{c.total}</span>
                      <BandChip band={c.band} />
                    </div>
                  </div>
                </div>
                {CRITERIA.map(({ key, name }) => (
                  <div key={key} className="rounded-2xl bg-sunk p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-medium text-ink-2">{name}</p>
                      <span className="tabular text-xs text-faint">
                        {levels?.[key]}/3{c.assessment?.criteria[key].unclear ? " ?" : ""}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-3 text-sm text-muted">
                      {c.assessment?.criteria[key].evidence ? `“${c.assessment.criteria[key].evidence}”` : "Nothing in the CV"}
                    </p>
                  </div>
                ))}
                <p className="text-xs text-faint">
                  {role === r ? "" : `On the ${r} list · `}
                  {c.decision ? (c.decision === "advance" ? "Advanced" : "Passed") : "Undecided"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

