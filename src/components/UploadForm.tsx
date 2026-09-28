"use client";

import { useState } from "react";
import Link from "next/link";
import type { Role } from "@/lib/types";

type Result = { id: string; name: string; band: string; total: number; listRole: string; duplicate: boolean };
type Item = {
  key: string;
  label: string;
  state: "queued" | "scoring" | "done" | "error";
  result?: Result;
  error?: string;
};

const CONCURRENCY = 2;

export function UploadForm() {
  const [role, setRole] = useState<Role>("PM");
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  const count = files.length + (text.trim() ? 1 : 0);

  function update(key: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  async function submitOne(key: string, body: FormData) {
    update(key, { state: "scoring" });
    try {
      const res = await fetch("/api/candidates", { method: "POST", body });
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
    if (text.trim()) {
      const body = new FormData();
      body.set("role", role);
      body.set("text", text);
      jobs.push({ key: `${stamp}-text`, label: "Pasted CV", body });
    }
    if (!jobs.length) return;
    setRunning(true);
    setItems((prev) => [...jobs.map((j) => ({ key: j.key, label: j.label, state: "queued" as const })), ...prev]);

    const queue = [...jobs];
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (queue.length) {
          const job = queue.shift()!;
          await submitOne(job.key, job.body);
        }
      }),
    );
    setFiles([]);
    setText("");
    setInputKey((k) => k + 1);
    setRunning(false);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-5 rounded-lg border border-line bg-surface p-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Role they applied for</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            {(["PM", "SPM"] as Role[]).map((r) => (
              <label key={r} className="flex items-center gap-2">
                <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} />
                {r === "PM" ? "Product Manager" : "Senior Product Manager"}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm">
          <span className="font-medium">CV files</span>
          <span className="ml-2 text-muted">.docx, .pdf or .txt. You can select several.</span>
          <input
            key={inputKey}
            type="file"
            multiple
            accept=".docx,.pdf,.txt,.md"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="mt-2 block w-full text-sm file:mr-3 file:rounded file:border file:border-line file:bg-bg file:px-3 file:py-1.5"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Or paste a CV</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="mt-2 w-full rounded border border-line p-2 font-mono text-xs"
            placeholder="Paste the full CV text here"
          />
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={run}
            disabled={running || count === 0}
            className="rounded bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {running ? "Scoring…" : count > 1 ? `Score ${count} CVs` : "Score CV"}
          </button>
          <p className="text-xs text-muted">
            Each CV takes 10–30 seconds. It is scored against the rubric, then a brief is written.
          </p>
        </div>
      </div>

      {items.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
          {items.map((i) => (
            <li key={i.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span className="font-medium">{i.result?.name ?? i.label}</span>
              <span className="text-muted">
                {i.state === "queued" && "Queued"}
                {i.state === "scoring" && "Scoring…"}
                {i.state === "error" && <span className="text-bad">{i.error}</span>}
                {i.state === "done" && i.result && (
                  <>
                    {i.result.duplicate ? "Already scored · " : ""}
                    {i.result.band} · {i.result.total}/100 on {i.result.listRole} ·{" "}
                    <Link href={`/candidates/${i.result.id}`} className="text-accent underline">
                      Open brief
                    </Link>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
