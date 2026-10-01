"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Send } from "lucide-react";
import { useDecisions } from "./DecisionProvider";
import { Avatar, EmailStatus } from "./ui";
import type { EmailRow } from "@/lib/types";

type Row = EmailRow & { candidate_name: string };
type Filter = "all" | "draft" | "sent" | "failed";

export function OutboxList({ emails }: { emails: Row[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const { openReview } = useDecisions();
  const counts = {
    all: emails.length,
    draft: emails.filter((e) => e.status === "draft").length,
    sent: emails.filter((e) => e.status === "sent").length,
    failed: emails.filter((e) => e.status === "failed").length,
  };
  const list = emails.filter((e) => filter === "all" || e.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex w-fit rounded-full bg-white/70 p-1 ring-1 ring-line" role="tablist">
        {(
          [
            ["all", "All"],
            ["draft", "Drafts"],
            ["sent", "Sent"],
            ["failed", "Failed"],
          ] as [Filter, string][]
        ).map(([k, label]) =>
          k === "failed" && !counts.failed ? null : (
            <button
              key={k}
              role="tab"
              aria-selected={filter === k}
              onClick={() => setFilter(k)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm ${filter === k ? "bg-ink text-white" : "text-ink-2 hover:text-ink"}`}
            >
              {label} <span className={`tabular text-xs ${filter === k ? "text-white/70" : "text-faint"}`}>{counts[k]}</span>
            </button>
          ),
        )}
      </div>

      <ul className="card divide-y divide-line p-0">
        {list.map((e) => {
          const isOpen = open === e.id;
          return (
            <li key={e.id}>
              <button
                onClick={() => setOpen(isOpen ? null : e.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/60 sm:px-5"
              >
                <Avatar name={e.candidate_name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {e.candidate_name} <span className="font-normal text-faint">· {e.kind === "invite" ? "Invite" : "Rejection"}</span>
                  </p>
                  <p className="truncate text-sm text-muted">{e.subject}</p>
                </div>
                <EmailStatus status={e.status} />
                <ChevronDown className={`size-4 shrink-0 text-faint transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="animate-rise px-4 pb-5 sm:px-5 sm:pl-[4.25rem]">
                  <p className="text-xs text-muted">
                    To {e.to_email ?? "no address"}
                    {e.error && <span className={e.status === "failed" ? "text-bad" : ""}> · {e.error}</span>} ·{" "}
                    <Link href={`/candidates/${e.candidate_id}`} className="text-accent hover:underline">
                      View candidate
                    </Link>
                  </p>
                  <pre className="mt-3 rounded-2xl bg-sunk p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap text-ink-2">{e.body}</pre>
                  {e.status !== "sent" && (
                    <button
                      onClick={() => openReview(e.candidate_id, e.candidate_name)}
                      className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-white hover:bg-ink-2"
                    >
                      <Send className="size-4" /> Review &amp; send
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {list.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">Nothing here.</li>}
      </ul>
    </div>
  );
}
