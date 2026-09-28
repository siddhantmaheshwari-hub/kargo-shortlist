"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EmailRow } from "@/lib/types";

const UNDO_SECONDS = 8;

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

/**
 * Advance / Pass. Clicking drafts the email immediately, then sends it after a
 * short undo window. Without RESEND_API_KEY the email stays saved as a draft.
 */
export function DecisionButtons({
  candidateId,
  decision,
  emailStatus,
  compact = false,
}: {
  candidateId: string;
  decision: "advance" | "pass" | null;
  emailStatus: EmailRow["status"] | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "advance" | "pass" | "undo">(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  async function send(emailId: string) {
    try {
      await post(`/api/emails/${emailId}/send`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setCountdown(null);
    router.refresh();
  }

  async function choose(d: "advance" | "pass") {
    setError(null);
    setBusy(d);
    try {
      const { emailId } = await post(`/api/candidates/${candidateId}/decision`, { decision: d });
      router.refresh();
      let left = UNDO_SECONDS;
      setCountdown(left);
      timer.current = setInterval(() => {
        left -= 1;
        if (left <= 0) {
          if (timer.current) clearInterval(timer.current);
          void send(emailId);
        } else {
          setCountdown(left);
        }
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function undo() {
    if (timer.current) clearInterval(timer.current);
    setCountdown(null);
    setBusy("undo");
    try {
      await post(`/api/candidates/${candidateId}/undo`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(null);
    router.refresh();
  }

  const size = compact ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm";

  if (countdown !== null) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted">Sending in {countdown}s</span>
        <button onClick={undo} className="rounded border border-line bg-surface px-2 py-1 font-medium hover:bg-bg">
          Undo
        </button>
      </div>
    );
  }

  if (decision) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`rounded px-2 py-0.5 font-medium ${decision === "advance" ? "bg-good-bg text-good" : "bg-bg text-muted"}`}
        >
          {decision === "advance" ? "Advanced" : "Passed"}
        </span>
        {emailStatus && (
          <span className={emailStatus === "sent" ? "text-good" : emailStatus === "failed" ? "text-bad" : "text-warn"}>
            {emailStatus === "sent" ? "email sent" : emailStatus === "failed" ? "email failed" : "email saved as draft"}
          </span>
        )}
        {emailStatus !== "sent" && (
          <button onClick={undo} disabled={busy !== null} className="text-muted underline hover:text-ink disabled:opacity-50">
            {busy === "undo" ? "Undoing…" : "Undo"}
          </button>
        )}
        {error && <span className="text-bad">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => choose("advance")}
        disabled={busy !== null}
        className={`rounded bg-ink font-medium text-white hover:opacity-90 disabled:opacity-50 ${size}`}
      >
        {busy === "advance" ? "Drafting…" : "Advance"}
      </button>
      <button
        onClick={() => choose("pass")}
        disabled={busy !== null}
        className={`rounded border border-line bg-surface font-medium hover:bg-bg disabled:opacity-50 ${size}`}
      >
        {busy === "pass" ? "Drafting…" : "Pass"}
      </button>
      {error && <span className="text-xs text-bad">{error}</span>}
    </div>
  );
}
