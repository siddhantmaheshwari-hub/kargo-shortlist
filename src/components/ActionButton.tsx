"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** A button that POSTs to an API route, shows the result, and refreshes the page. */
export function ActionButton({
  url,
  label,
  busyLabel,
  confirm,
  variant = "secondary",
}: {
  url: string;
  label: string;
  busyLabel: string;
  confirm?: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function go() {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
      if (typeof json.sent === "number") setMsg(`${json.sent} sent, ${json.notSent} not sent`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const style = variant === "primary" ? "bg-ink text-white hover:bg-ink-2" : "border border-line-strong bg-surface-solid hover:bg-sunk";
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button onClick={go} disabled={busy} className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition disabled:opacity-50 ${style}`}>
        {busy ? busyLabel : label}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </span>
  );
}
