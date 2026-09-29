"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ClipboardPaste, FileText, Loader2, UploadCloud, X } from "lucide-react";
import type { Role } from "@/lib/types";

type Result = { id: string; name: string; band: string; total: number; listRole: string; duplicate: boolean };
type Item = {
  key: string;
  label: string;
  state: "queued" | "uploading" | "scoring" | "done" | "error";
  result?: Result;
  error?: string;
};

const CONCURRENCY = 2;
const ACCEPT = [".docx", ".pdf", ".txt", ".md"];
const ROLE_KEY = "kargo.upload.role";

const ROLE_CARDS: { role: Role; title: string; hint: string }[] = [
  { role: "PM", title: "Product Manager", hint: "Shortlist at 65+" },
  { role: "SPM", title: "Senior Product Manager", hint: "Shortlist at 70+" },
];

function StageDot({ state }: { state: Item["state"] }) {
  if (state === "done") return <span className="flex size-7 items-center justify-center rounded-full bg-good-bg text-good"><Check className="size-4" /></span>;
  if (state === "error") return <span className="flex size-7 items-center justify-center rounded-full bg-bad-bg text-bad"><AlertCircle className="size-4" /></span>;
  if (state === "queued") return <span className="flex size-7 items-center justify-center rounded-full bg-sunk text-faint"><FileText className="size-4" /></span>;
  return <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-accent"><Loader2 className="size-4 animate-spin" /></span>;
}

const STAGE_TEXT: Record<Item["state"], string> = {
  queued: "Waiting",
  uploading: "Uploading",
  scoring: "Reading, scoring against the rubric, writing the brief…",
  done: "Done",
  error: "Failed",
};

export function UploadForm() {
  const router = useRouter();
  // Remember the last role picked (per browser). Server render defaults to PM.
  const savedRole = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        const v = localStorage.getItem(ROLE_KEY);
        return v === "SPM" ? "SPM" : "PM";
      } catch {
        return "PM";
      }
    },
    () => "PM",
  ) as Role;
  const [picked, setPicked] = useState<Role | null>(null);
  const role = picked ?? savedRole;
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickRole(r: Role) {
    setPicked(r);
    try {
      localStorage.setItem(ROLE_KEY, r);
    } catch {}
  }

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    const ok = incoming.filter((f) => ACCEPT.some((ext) => f.name.toLowerCase().endsWith(ext)));
    setRejected(incoming.filter((f) => !ok.includes(f)).map((f) => f.name));
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...ok.filter((f) => !names.has(f.name + f.size))];
    });
  }

  const count = files.length + (text.trim().length >= 200 ? 1 : 0);

  function update(key: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  async function submitOne(key: string, body: FormData) {
    update(key, { state: "uploading" });
    try {
      const req = fetch("/api/candidates", { method: "POST", body });
      // The request body is small; once it's sent the server is scoring.
      setTimeout(() => update(key, { state: "scoring" }), 400);
      const res = await req;
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
      update(key, { state: "done", result: json });
    } catch (e) {
      update(key, { state: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }

  async function run() {
    const stamp = Date.now();
    const jobs = files.map((f, i) => {
      const body = new FormData();
      body.set("role", role);
      body.set("file", f);
      return { key: `${stamp}-${i}`, label: f.name, body };
    });
    if (text.trim().length >= 200) {
      const body = new FormData();
      body.set("role", role);
      body.set("text", text);
      jobs.push({ key: `${stamp}-text`, label: "Pasted CV", body });
    }
    if (!jobs.length) return;
    setRunning(true);
    setItems((prev) => [...jobs.map((j) => ({ key: j.key, label: j.label, state: "queued" as const })), ...prev]);
    setFiles([]);
    setText("");
    setShowPaste(false);

    const queue = [...jobs];
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (queue.length) {
          const job = queue.shift()!;
          await submitOne(job.key, job.body);
        }
      }),
    );
    setRunning(false);
    router.refresh();
  }

  const done = items.filter((i) => i.state === "done");
  const inFlight = items.some((i) => i.state === "queued" || i.state === "uploading" || i.state === "scoring");

  return (
    <div className="space-y-5">
      <div className="card space-y-5 p-5 sm:p-6">
        <div>
          <p className="mb-2 text-sm font-medium">Which role did they apply for?</p>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {ROLE_CARDS.map((r) => {
              const active = role === r.role;
              return (
                <button
                  key={r.role}
                  role="radio"
                  aria-checked={active}
                  onClick={() => pickRole(r.role)}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                    active ? "border-ink bg-surface-solid ring-1 ring-ink" : "border-line bg-surface-solid/60 hover:border-line-strong"
                  }`}
                >
                  <span className={`flex size-5 items-center justify-center rounded-full border ${active ? "border-ink bg-ink text-white" : "border-line-strong"}`}>
                    {active && <Check className="size-3" />}
                  </span>
                  <span>
                    <span className="block font-medium">{r.title}</span>
                    <span className="block text-xs text-muted">Scored on both rubrics · {r.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
            dragging ? "border-accent bg-accent-soft/50" : "border-line-strong bg-surface-solid/50 hover:border-accent/60"
          }`}
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <UploadCloud className="size-6" />
          </span>
          <p className="mt-3 font-medium">Drop CVs here, or click to choose</p>
          <p className="text-sm text-muted">.docx, .pdf or .txt · select as many as you like</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT.join(",")}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {rejected.length > 0 && (
          <p className="text-sm text-bad">Skipped {rejected.join(", ")}: only .docx, .pdf and .txt files can be read.</p>
        )}

        {files.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {files.map((f) => (
              <li key={f.name + f.size} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-solid py-1 pr-1 pl-3 text-sm">
                <FileText className="size-3.5 text-faint" />
                <span className="max-w-[16rem] truncate">{f.name}</span>
                <button
                  onClick={() => setFiles((prev) => prev.filter((x) => x !== f))}
                  aria-label={`Remove ${f.name}`}
                  className="rounded-full p-1 text-faint hover:bg-sunk hover:text-ink"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {showPaste ? (
          <label className="block">
            <span className="text-sm font-medium">Paste a CV</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              autoFocus
              className="mt-2 w-full rounded-2xl border border-line bg-surface-solid p-3 text-sm outline-none focus:border-accent"
              placeholder="Paste the full CV text"
            />
            {text.trim().length > 0 && text.trim().length < 200 && <span className="text-xs text-warn">Needs at least 200 characters to score fairly.</span>}
          </label>
        ) : (
          <button onClick={() => setShowPaste(true)} className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
            <ClipboardPaste className="size-4" /> Or paste CV text
          </button>
        )}

        <div className="flex flex-wrap items-center gap-4 border-t border-line pt-4">
          <button
            onClick={run}
            disabled={running || count === 0}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white transition hover:bg-ink-2 disabled:opacity-40"
          >
            {running && <Loader2 className="size-4 animate-spin" />}
            {count > 1 ? `Score ${count} CVs` : "Score CV"}
          </button>
          <p className="text-xs text-muted">About 15 seconds each. You can leave this page; results stay saved.</p>
        </div>
      </div>

      {items.length > 0 && (
        <div className="card p-2">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-sm font-medium">
              {inFlight ? "Scoring…" : "Completed"} <span className="tabular text-faint">{done.length}/{items.length}</span>
            </p>
            {!inFlight && done.length > 0 && (
              <Link href={`/roles/${(done[0].result?.listRole ?? role).toLowerCase()}`} className="text-sm text-accent hover:underline">
                Review ranked list →
              </Link>
            )}
          </div>
          <ul>
            {items.map((i) => (
              <li key={i.key} className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
                <StageDot state={i.state} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.result?.name ?? i.label}</p>
                  <p className={`truncate text-xs ${i.state === "error" ? "text-bad" : "text-muted"}`}>
                    {i.state === "error"
                      ? i.error
                      : i.state === "done" && i.result
                        ? `${i.result.duplicate ? "Already scored · " : ""}${i.result.band} · ${i.result.total}/100 on ${i.result.listRole}`
                        : STAGE_TEXT[i.state]}
                  </p>
                </div>
                {i.state === "done" && i.result && (
                  <Link href={`/candidates/${i.result.id}`} className="shrink-0 rounded-full border border-line px-3 py-1 text-xs hover:bg-sunk">
                    Open
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
