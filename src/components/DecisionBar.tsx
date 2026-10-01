"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, RotateCcw, Send, X } from "lucide-react";
import { useDecisions } from "./DecisionProvider";
import { passReasons } from "@/lib/signals";
import type { Assessment, Band, EmailRow, Role } from "@/lib/types";

export interface DecisionTarget {
  id: string;
  name: string;
  email: string | null;
  decision: "advance" | "pass" | null;
  decision_note: string | null;
  email_status: EmailRow["status"] | null;
  assessment: Assessment | null;
  band: Band | null;
  role: Role;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-1.5 hidden rounded border border-current/25 px-1 font-mono text-[10px] leading-4 opacity-70 sm:inline">{children}</kbd>
  );
}

/** Advance to interview / Reject, or the recorded decision with Undo while the email is unsent. */
export function DecisionBar({ c, showKeys = false }: { c: DecisionTarget; showKeys?: boolean }) {
  const router = useRouter();
  const { decide, busyIds, notify, openReview } = useDecisions();
  const [undoing, setUndoing] = useState(false);
  const busy = busyIds.has(c.id);

  async function undo() {
    setUndoing(true);
    const res = await fetch(`/api/candidates/${c.id}/undo`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setUndoing(false);
    if (!res.ok) notify("Couldn't undo", json.error, "bad");
    else notify("Decision undone", "No email was sent");
    router.refresh();
  }

  if (c.decision) {
    const advanced = c.decision === "advance";
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium ${
            advanced ? "bg-good-bg text-good" : "bg-bad-bg text-bad"
          }`}
        >
          {advanced ? <Check className="size-4" /> : <X className="size-4" />}
          {advanced ? "Invited to interview" : "Rejected"}
        </span>
        <span className="min-w-0 text-sm text-muted">
          {c.decision_note && <span className="text-ink-2">{c.decision_note} · </span>}
          {c.email_status === "sent"
            ? "Email sent"
            : c.email_status === "failed"
              ? "Email failed to send"
              : c.email_status === "draft"
                ? "Email not sent yet"
                : ""}
        </span>
        {(c.email_status === "draft" || c.email_status === "failed") && (
          <button
            onClick={() => openReview(c.id, c.name)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-medium text-white hover:bg-ink-2"
          >
            <Send className="size-3.5" /> Review &amp; send
          </button>
        )}
        {c.email_status !== "sent" && (
          <button onClick={undo} disabled={undoing} className="inline-flex items-center gap-1 text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
            {undoing ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />} Undo
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        disabled={busy}
        onClick={() => decide([c.id], "advance", { names: [c.name] })}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white transition hover:bg-ink-2 disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
        Advance to interview
        {showKeys && <Kbd>A</Kbd>}
      </button>
      <button
        disabled={busy}
        onClick={() => decide([c.id], "pass", { names: [c.name], reasons: passReasons(c.assessment, c.role, c.band) })}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-surface-solid px-5 text-sm font-medium transition hover:bg-sunk disabled:opacity-50"
      >
        <X className="size-4" />
        Reject
        {showKeys && <Kbd>R</Kbd>}
      </button>
      {!c.email && <span className="text-xs text-warn">No email on CV: the follow-up will be saved as a draft</span>}
    </div>
  );
}
