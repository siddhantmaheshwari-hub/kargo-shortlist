import Link from "next/link";
import { ActionButton } from "@/components/ActionButton";
import { Card, EmailStatus, SetupNotice } from "@/components/ui";
import { outbox } from "@/lib/data";
import { emailSendingEnabled } from "@/lib/email";

export default async function OutboxPage() {
  let emails: Awaited<ReturnType<typeof outbox>>;
  try {
    emails = await outbox();
  } catch (e) {
    return <SetupNotice error={e} />;
  }
  const enabled = emailSendingEnabled();
  const unsent = emails.filter((e) => e.status !== "sent").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Outbox</h1>
          <p className="mt-1 text-sm text-muted">
            {enabled
              ? "Emails send automatically after Advance or Pass."
              : "RESEND_API_KEY isn't set, so every email is saved here as a draft. Add the key and send them in one go."}
          </p>
        </div>
        {enabled && unsent > 0 && (
          <ActionButton
            url="/api/emails/send-drafts"
            label={`Send ${unsent} unsent`}
            busyLabel="Sending…"
            variant="primary"
            confirm={`Send ${unsent} email(s) now?`}
          />
        )}
      </div>

      {emails.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">No emails yet. They appear here when you Advance or Pass a candidate.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {emails.map((e) => (
            <li key={e.id}>
              <details className="rounded-lg border border-line bg-surface p-4">
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">{e.candidate_name}</span>
                  <span className="text-muted">{e.kind === "invite" ? "Invite" : "Rejection"}</span>
                  <EmailStatus status={e.status} />
                  <span className="text-muted">{e.subject}</span>
                </summary>
                <p className="mt-3 text-xs text-muted">
                  To: {e.to_email ?? "no address"}
                  {e.error && ` · ${e.error}`} ·{" "}
                  <Link href={`/candidates/${e.candidate_id}`} className="underline">
                    candidate
                  </Link>
                </p>
                <pre className="mt-2 font-sans text-sm whitespace-pre-wrap">{e.body}</pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
