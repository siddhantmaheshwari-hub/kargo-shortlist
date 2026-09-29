"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2, Mail, RotateCcw, X } from "lucide-react";

const UNDO_SECONDS = 8;

type Decision = "advance" | "pass";

interface Toast {
  id: number;
  tone: "neutral" | "good" | "bad";
  title: string;
  detail?: string;
  state: "working" | "countdown" | "done" | "error";
  left?: number;
  emailIds?: string[];
  candidateIds?: string[];
  reasons?: string[];
  reason?: string;
  href?: string;
}

interface DecideOptions {
  names: string[];
  reasons?: string[]; // suggested pass reasons (single candidate); first is the default
}

interface Ctx {
  decide: (ids: string[], decision: Decision, opts: DecideOptions) => Promise<boolean>;
  notify: (title: string, detail?: string, tone?: Toast["tone"]) => void;
  busyIds: Set<string>;
}

const DecisionCtx = createContext<Ctx | null>(null);

export function useDecisions(): Ctx {
  const ctx = useContext(DecisionCtx);
  if (!ctx) throw new Error("useDecisions must be used inside <DecisionProvider>");
  return ctx;
}

async function post<T = Record<string, unknown>>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
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

export function DecisionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const timers = useRef(new Map<number, ReturnType<typeof setInterval>>());
  const seq = useRef(0);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((i) => clearInterval(i));
  }, []);

  const patch = useCallback((id: number, p: Partial<Toast>) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...p } : t)));
  }, []);

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearInterval(timer);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const autoDismiss = useCallback((id: number, ms = 5000) => setTimeout(() => dismiss(id), ms), [dismiss]);

  const notify = useCallback(
    (title: string, detail?: string, tone: Toast["tone"] = "neutral") => {
      const id = ++seq.current;
      setToasts((prev) => [...prev, { id, title, detail, tone, state: tone === "bad" ? "error" : "done" }]);
      autoDismiss(id);
    },
    [autoDismiss],
  );

  const sendAll = useCallback(
    async (id: number, emailIds: string[]) => {
      patch(id, { state: "working", detail: "Sending…" });
      let sent = 0;
      let drafts = 0;
      let failed = 0;
      let lastError = "";
      for (const e of emailIds) {
        try {
          const r = await post<{ status: string; error: string | null }>(`/api/emails/${e}/send`);
          if (r.status === "sent") sent++;
          else if (r.status === "failed") {
            failed++;
            lastError = r.error ?? "";
          } else drafts++;
        } catch (err) {
          failed++;
          lastError = err instanceof Error ? err.message : String(err);
        }
      }
      const parts = [
        sent && `${plural(sent, "email")} sent`,
        drafts && `${plural(drafts, "email")} saved as draft${drafts && !sent ? " (add RESEND_API_KEY to send)" : ""}`,
        failed && `${failed} failed${lastError ? `: ${lastError}` : ""}`,
      ].filter(Boolean);
      patch(id, { state: failed ? "error" : "done", tone: failed ? "bad" : "good", detail: parts.join(" · "), href: "/outbox" });
      router.refresh();
      autoDismiss(id, failed ? 9000 : 5000);
    },
    [patch, router, autoDismiss],
  );

  const decide = useCallback(
    async (ids: string[], decision: Decision, opts: DecideOptions) => {
      const id = ++seq.current;
      const verb = decision === "advance" ? "Advanced" : "Passed";
      const who = ids.length === 1 ? opts.names[0] : plural(ids.length, "candidate");
      setBusyIds((prev) => new Set([...prev, ...ids]));
      setToasts((prev) => [
        ...prev,
        {
          id,
          tone: "neutral",
          state: "working",
          title: `${verb} ${who}`,
          detail: decision === "advance" ? "Drafting the interview invite…" : "Drafting a respectful rejection…",
        },
      ]);

      let emailIds: string[] = [];
      const errors: string[] = [];
      try {
        if (ids.length === 1) {
          const reason = opts.reasons?.[0];
          const r = await post<{ emailId: string }>(`/api/candidates/${ids[0]}/decision`, { decision, note: reason });
          emailIds = [r.emailId];
        } else {
          const r = await post<{ results: { emailId?: string; error?: string }[] }>(`/api/decisions`, { ids, decision });
          emailIds = r.results.filter((x) => x.emailId).map((x) => x.emailId!);
          r.results.filter((x) => x.error).forEach((x) => errors.push(x.error!));
        }
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyIds((prev) => {
          const next = new Set(prev);
          ids.forEach((i) => next.delete(i));
          return next;
        });
      }
      router.refresh();

      if (!emailIds.length) {
        patch(id, { state: "error", tone: "bad", title: `Couldn't record the decision`, detail: errors[0] });
        autoDismiss(id, 9000);
        return false;
      }

      const reasons = ids.length === 1 && decision === "pass" ? opts.reasons : undefined;
      patch(id, {
        state: "countdown",
        left: UNDO_SECONDS,
        emailIds,
        candidateIds: ids,
        reasons,
        reason: reasons?.[0],
        detail: errors.length ? `${errors.length} couldn't be drafted` : undefined,
        tone: decision === "advance" ? "good" : "neutral",
      });
      let left = UNDO_SECONDS;
      const timer = setInterval(() => {
        left -= 1;
        if (left <= 0) {
          clearInterval(timer);
          timers.current.delete(id);
          void sendAll(id, emailIds);
        } else {
          patch(id, { left });
        }
      }, 1000);
      timers.current.set(id, timer);
      return true;
    },
    [router, patch, sendAll, autoDismiss],
  );

  async function undo(t: Toast) {
    const timer = timers.current.get(t.id);
    if (timer) clearInterval(timer);
    timers.current.delete(t.id);
    patch(t.id, { state: "working", detail: "Undoing…" });
    const results = await Promise.allSettled((t.candidateIds ?? []).map((c) => post(`/api/candidates/${c}/undo`)));
    const failed = results.filter((r) => r.status === "rejected").length;
    router.refresh();
    patch(t.id, {
      state: failed ? "error" : "done",
      tone: failed ? "bad" : "neutral",
      title: failed ? "Couldn't undo everything" : "Undone",
      detail: failed ? `${failed} email(s) had already gone out` : "No email was sent",
      reasons: undefined,
    });
    autoDismiss(t.id, 4000);
  }

  async function changeReason(t: Toast, reason: string) {
    patch(t.id, { reason });
    const cid = t.candidateIds?.[0];
    if (!cid) return;
    try {
      await post(`/api/candidates/${cid}/note`, { note: reason });
    } catch (e) {
      notify("Reason not saved", e instanceof Error ? e.message : String(e), "bad");
    }
  }

  return (
    <DecisionCtx.Provider value={{ decide, notify, busyIds }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
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
                {t.state === "working" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : t.state === "error" ? (
                  <X className="size-3.5" />
                ) : t.state === "countdown" ? (
                  <Mail className="size-3.5" />
                ) : (
                  <Check className="size-3.5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.title}</p>
                {t.state === "countdown" ? (
                  <p className="text-sm text-muted">
                    Email goes out in <span className="tabular font-medium text-ink">{t.left}s</span>
                    {t.detail ? ` · ${t.detail}` : ""}
                  </p>
                ) : (
                  t.detail && <p className="text-sm text-muted">{t.detail}</p>
                )}
                {t.state === "countdown" && t.reasons && (
                  <div className="mt-2">
                    <p className="text-xs text-faint">Reason (recorded, never sent to the candidate)</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {t.reasons.map((r) => (
                        <button
                          key={r}
                          onClick={() => changeReason(t, r)}
                          className={`rounded-full border px-2.5 py-1 text-xs transition ${
                            t.reason === r ? "border-ink bg-ink text-white" : "border-line bg-surface-solid text-ink-2 hover:border-line-strong"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {t.href && t.state !== "countdown" && t.state !== "working" && (
                  <Link href={t.href} className="mt-1 inline-block text-xs text-accent underline underline-offset-2">
                    Open outbox
                  </Link>
                )}
              </div>
              {t.state === "countdown" ? (
                <button
                  onClick={() => undo(t)}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-medium hover:bg-sunk"
                >
                  <RotateCcw className="size-3.5" /> Undo
                </button>
              ) : (
                t.state !== "working" && (
                  <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="rounded-full p-1 text-faint hover:text-ink">
                    <X className="size-4" />
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </DecisionCtx.Provider>
  );
}
