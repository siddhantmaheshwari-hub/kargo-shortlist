"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Check, ChevronDown, Loader2, Mail, Send, X } from "lucide-react";
import type { EmailRow } from "@/lib/types";

type Decision = "advance" | "pass";

interface Toast {
  id: number;
  tone: "neutral" | "good" | "bad";
  state: "working" | "done" | "error";
  title: string;
  detail?: string;
  href?: string;
}

interface ReviewItem {
  candidateId: string;
  name: string;
  emailId: string;
  to: string;
  subject: string;
  body: string;
}

interface Review {
  decision: Decision;
  items: ReviewItem[];
  sendingEnabled: boolean;
  testRecipient: string | null;
  reasons?: string[];
  reason?: string;
  failed: string[]; // candidates whose email couldn't be drafted
}

interface DecideOptions {
  names: string[];
  reasons?: string[]; // suggested pass reasons (single candidate); first is the default
}

interface Ctx {
  decide: (ids: string[], decision: Decision, opts: DecideOptions) => Promise<boolean>;
  openReview: (candidateId: string, name: string) => Promise<void>;
  notify: (title: string, detail?: string, tone?: Toast["tone"]) => void;
  busyIds: Set<string>;
  reviewing: boolean;
}

const DecisionCtx = createContext<Ctx | null>(null);

export function useDecisions(): Ctx {
  const ctx = useContext(DecisionCtx);
  if (!ctx) throw new Error("useDecisions must be used inside <DecisionProvider>");
  return ctx;
}

async function call<T = Record<string, unknown>>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as T;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function toItem(e: EmailRow, name: string): ReviewItem {
  return { candidateId: e.candidate_id, name, emailId: e.id, to: e.to_email ?? "", subject: e.subject, body: e.body };
}

export function DecisionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [review, setReview] = useState<Review | null>(null);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (t: Omit<Toast, "id">, ttl = 5000) => {
      const id = ++seq.current;
      setToasts((prev) => [...prev, { ...t, id }]);
      if (t.state !== "working") setTimeout(() => dismiss(id), ttl);
      return id;
    },
    [dismiss],
  );

  const notify = useCallback(
    (title: string, detail?: string, tone: Toast["tone"] = "neutral") => {
      push({ title, detail, tone, state: tone === "bad" ? "error" : "done" }, tone === "bad" ? 9000 : 5000);
    },
    [push],
  );

  const decide = useCallback(
    async (ids: string[], decision: Decision, opts: DecideOptions) => {
      const verb = decision === "advance" ? "Inviting" : "Rejecting";
      const who = ids.length === 1 ? opts.names[0] : plural(ids.length, "candidate");
      const working = push({
        tone: "neutral",
        state: "working",
        title: `${verb} ${who}`,
        detail: decision === "advance" ? "Drafting the interview invite for you to review…" : "Drafting a respectful rejection for you to review…",
      });
      setBusyIds((prev) => new Set([...prev, ...ids]));

      const items: ReviewItem[] = [];
      const failed: string[] = [];
      let sendingEnabled = false;
      let testTo: string | null = null;
      try {
        if (ids.length === 1) {
          const r = await call<{ email: EmailRow; sendingEnabled: boolean; testRecipient: string | null }>(`/api/candidates/${ids[0]}/decision`, {
            decision,
            note: opts.reasons?.[0],
          });
          items.push(toItem(r.email, opts.names[0]));
          sendingEnabled = r.sendingEnabled;
          testTo = r.testRecipient;
        } else {
          const r = await call<{ results: { candidateId: string; email?: EmailRow; error?: string }[]; sendingEnabled: boolean; testRecipient: string | null }>(
            `/api/decisions`,
            { ids, decision },
          );
          sendingEnabled = r.sendingEnabled;
          testTo = r.testRecipient;
          for (const x of r.results) {
            const name = opts.names[ids.indexOf(x.candidateId)] ?? "Candidate";
            if (x.email) items.push(toItem(x.email, name));
            else failed.push(`${name}: ${x.error}`);
          }
        }
      } catch (e) {
        failed.push(e instanceof Error ? e.message : String(e));
      } finally {
        dismiss(working);
        setBusyIds((prev) => {
          const next = new Set(prev);
          ids.forEach((i) => next.delete(i));
          return next;
        });
        router.refresh();
      }

      if (!items.length) {
        notify("Couldn't record the decision", failed[0], "bad");
        return false;
      }
      const reasons = ids.length === 1 && decision === "pass" ? opts.reasons : undefined;
      setReview({ decision, items, sendingEnabled, testRecipient: testTo, reasons, reason: reasons?.[0], failed });
      return true;
    },
    [push, dismiss, notify, router],
  );

  const openReview = useCallback(
    async (candidateId: string, name: string) => {
      try {
        const r = await call<{ email: EmailRow; sendingEnabled: boolean; testRecipient: string | null }>(`/api/candidates/${candidateId}/email`, undefined, "GET");
        if (r.email.status === "sent") {
          notify("Already sent", "This email has already gone to the candidate.");
          return;
        }
        setReview({
          decision: r.email.kind === "invite" ? "advance" : "pass",
          items: [toItem(r.email, name)],
          sendingEnabled: r.sendingEnabled,
          testRecipient: r.testRecipient,
          failed: [],
        });
      } catch (e) {
        notify("Couldn't open the email", e instanceof Error ? e.message : String(e), "bad");
      }
    },
    [notify],
  );

  return (
    <DecisionCtx.Provider value={{ decide, openReview, notify, busyIds, reviewing: review !== null }}>
      {children}
      {review && (
        <ReviewDialog
          review={review}
          onChange={setReview}
          onClose={() => {
            setReview(null);
            router.refresh();
          }}
          notify={notify}
        />
      )}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-rise pointer-events-auto w-full max-w-md rounded-2xl border border-line bg-surface-solid px-4 py-3 shadow-[0_8px_30px_rgb(19_35_34/0.08)]"
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
                  t.state === "error" ? "bg-bad-bg text-bad" : t.tone === "good" ? "bg-good-bg text-good" : "bg-sunk text-ink-2"
                }`}
              >
                {t.state === "working" ? <Loader2 className="size-3.5 animate-spin" /> : t.state === "error" ? <X className="size-3.5" /> : <Check className="size-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.title}</p>
                {t.detail && <p className="text-sm text-muted">{t.detail}</p>}
                {t.href && (
                  <Link href={t.href} className="mt-1 inline-block text-xs text-accent underline underline-offset-2">
                    Open outbox
                  </Link>
                )}
              </div>
              {t.state !== "working" && (
                <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="rounded-full p-1 text-faint hover:text-ink">
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </DecisionCtx.Provider>
  );
}

/** Review, edit and then send (or keep as draft, or cancel) the drafted email(s). */
function ReviewDialog({
  review,
  onChange,
  onClose,
  notify,
}: {
  review: Review;
  onChange: (r: Review) => void;
  onClose: () => void;
  notify: (title: string, detail?: string, tone?: Toast["tone"]) => void;
}) {
  const [busy, setBusy] = useState<null | "send" | "draft" | "cancel">(null);
  const [open, setOpen] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const firstField = useRef<HTMLTextAreaElement>(null);
  const many = review.items.length > 1;
  const isInvite = review.decision === "advance";
  const missingTo = review.items.filter((i) => !i.to.trim()).length;

  useEffect(() => {
    firstField.current?.focus({ preventScroll: true });
  }, []);

  function edit(index: number, patch: Partial<ReviewItem>) {
    onChange({ ...review, items: review.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) });
  }

  async function saveDrafts(quiet = false) {
    setBusy("draft");
    setError(null);
    try {
      for (const it of review.items) await call(`/api/emails/${it.emailId}`, { subject: it.subject, body: it.body, to: it.to });
      if (!quiet) notify(review.items.length === 1 ? "Saved as draft" : `Saved as ${review.items.length} drafts`, "Nothing was sent. Find it in the Outbox or on the candidate's profile.");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  async function send() {
    setBusy("send");
    setError(null);
    let sent = 0;
    let drafts = 0;
    const problems: string[] = [];
    for (const it of review.items) {
      try {
        const r = await call<{ status: string; error: string | null }>(`/api/emails/${it.emailId}/send`, { subject: it.subject, body: it.body, to: it.to });
        if (r.status === "sent") sent++;
        else if (r.status === "failed") problems.push(`${it.name}: ${r.error ?? "failed"}`);
        else drafts++;
      } catch (e) {
        problems.push(`${it.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (problems.length) {
      notify(
        sent ? `${plural(sent, "email")} sent, ${problems.length} failed` : "Email not sent",
        problems[0],
        "bad",
      );
    } else if (sent) {
      notify(
        `${plural(sent, "email")} sent`,
        review.testRecipient ? `Test mode: delivered to ${review.testRecipient}` : isInvite ? "The interview invite is on its way." : "The candidate has been told, respectfully.",
        "good",
      );
    } else if (drafts) {
      notify(drafts === 1 ? "Saved as draft" : `Saved as ${drafts} drafts`, "Sending is off until RESEND_API_KEY is set.");
    }
    onClose();
  }

  async function cancelDecision() {
    setBusy("cancel");
    setError(null);
    const results = await Promise.allSettled(review.items.map((it) => call(`/api/candidates/${it.candidateId}/undo`)));
    const failed = results.filter((r) => r.status === "rejected").length;
    notify(failed ? "Couldn't cancel everything" : "Decision cancelled", failed ? `${failed} couldn't be undone` : "No email was sent.", failed ? "bad" : "neutral");
    onClose();
  }

  async function changeReason(reason: string) {
    onChange({ ...review, reason });
    try {
      await call(`/api/candidates/${review.items[0].candidateId}/note`, { note: reason });
    } catch (e) {
      notify("Reason not saved", e instanceof Error ? e.message : String(e), "bad");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/25 p-4 backdrop-blur-sm sm:items-center sm:p-8"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) void saveDrafts(true);
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="review-title" className="card w-full max-w-2xl bg-surface-solid p-0">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <p className={`text-xs font-medium ${isInvite ? "text-good" : "text-bad"}`}>
              {isInvite ? "Invited to interview" : "Rejected"} · {review.sendingEnabled ? "nothing is sent until you press Send" : "sending is off, this will be saved as a draft"}
            </p>
            <h2 id="review-title" className="mt-0.5 font-display text-xl font-medium">
              Review {many ? `${review.items.length} ${isInvite ? "invites" : "rejections"}` : isInvite ? "the interview invite" : "the rejection email"}
            </h2>
          </div>
          <button onClick={() => void saveDrafts(true)} disabled={!!busy} aria-label="Close and keep as draft" className="rounded-full p-2 text-faint hover:bg-sunk hover:text-ink">
            <X className="size-5" />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
          {review.reasons && (
            <div>
              <p className="text-xs text-faint">Reason for rejecting (recorded for you, never sent to the candidate)</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {review.reasons.map((r) => (
                  <button
                    key={r}
                    onClick={() => changeReason(r)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      review.reason === r ? "border-ink bg-ink text-white" : "border-line bg-surface-solid text-ink-2 hover:border-line-strong"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {review.sendingEnabled && review.testRecipient && (
            <p className="flex items-start gap-2 rounded-2xl bg-info-bg px-3 py-2 text-sm text-info">
              <Mail className="mt-0.5 size-4 shrink-0" />
              <span>
                Test mode: this will be delivered to <b>{review.testRecipient}</b>, not the candidate. The subject will show who it was meant for.
              </span>
            </p>
          )}

          {review.failed.length > 0 && (
            <p className="flex items-start gap-2 rounded-2xl bg-bad-bg px-3 py-2 text-sm text-bad">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {review.failed.length} couldn&apos;t be drafted: {review.failed[0]}
            </p>
          )}

          {review.items.map((it, i) => {
            const expanded = !many || open === i;
            return (
              <div key={it.emailId} className={many ? "rounded-2xl border border-line" : ""}>
                {many && (
                  <button onClick={() => setOpen(expanded ? -1 : i)} aria-expanded={expanded} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <Mail className="size-4 text-faint" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{it.name}</span>
                    {!it.to.trim() && <span className="text-xs text-warn">No address</span>}
                    <ChevronDown className={`size-4 text-faint transition ${expanded ? "rotate-180" : ""}`} />
                  </button>
                )}
                {expanded && (
                  <div className={`space-y-3 ${many ? "border-t border-line px-4 py-3" : ""}`}>
                    <label className="flex items-center gap-3 text-sm">
                      <span className="w-16 shrink-0 text-faint">To</span>
                      <input
                        value={it.to}
                        onChange={(e) => edit(i, { to: e.target.value })}
                        placeholder="No address on the CV. Type one to send"
                        className={`h-10 min-w-0 flex-1 rounded-xl border bg-surface-solid px-3 outline-none focus:border-accent ${it.to.trim() ? "border-line" : "border-warn/60"}`}
                      />
                    </label>
                    <label className="flex items-center gap-3 text-sm">
                      <span className="w-16 shrink-0 text-faint">Subject</span>
                      <input
                        value={it.subject}
                        onChange={(e) => edit(i, { subject: e.target.value })}
                        className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface-solid px-3 outline-none focus:border-accent"
                      />
                    </label>
                    <textarea
                      ref={i === 0 ? firstField : undefined}
                      value={it.body}
                      onChange={(e) => edit(i, { body: e.target.value })}
                      rows={12}
                      aria-label={`Email to ${it.name}`}
                      className="w-full resize-y rounded-2xl border border-line bg-sunk/60 p-4 text-sm leading-relaxed text-ink-2 outline-none focus:border-accent focus:bg-surface-solid"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <button
            onClick={cancelDecision}
            disabled={!!busy}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-sm text-muted hover:bg-sunk hover:text-ink disabled:opacity-50"
          >
            {busy === "cancel" && <Loader2 className="size-4 animate-spin" />}
            Cancel decision
          </button>
          <div className="flex flex-1 flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            {error && <p className="text-sm text-bad sm:mr-auto">{error}</p>}
            {missingTo > 0 && review.sendingEnabled && !error && (
              <p className="text-xs text-warn sm:mr-auto">{plural(missingTo, "email")} without an address will stay as draft</p>
            )}
            <button
              onClick={() => saveDrafts()}
              disabled={!!busy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line-strong bg-surface-solid px-5 text-sm font-medium hover:bg-sunk disabled:opacity-50"
            >
              {busy === "draft" && <Loader2 className="size-4 animate-spin" />}
              Save as draft
            </button>
            {review.sendingEnabled && (
              <button
                onClick={send}
                disabled={!!busy}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink-2 disabled:opacity-50"
              >
                {busy === "send" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {many ? `Send ${review.items.length} emails` : "Send email"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
