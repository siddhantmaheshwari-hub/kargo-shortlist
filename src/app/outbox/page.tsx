import { ActionButton } from "@/components/ActionButton";
import { OutboxList } from "@/components/OutboxList";
import { Card, PageHeader, SetupNotice } from "@/components/ui";
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
    <div className="space-y-5">
      <PageHeader
        eyebrow={enabled ? "Each email is reviewed by you before it's sent" : "Sending is off: RESEND_API_KEY isn't set"}
        title="Outbox"
      >
        {enabled && unsent > 0 && (
          <ActionButton
            url="/api/emails/send-drafts"
            label={`Send ${unsent} unsent`}
            busyLabel="Sending…"
            variant="primary"
            confirm={`Send ${unsent} email(s) to candidates now?`}
          />
        )}
      </PageHeader>

      {!enabled && emails.length > 0 && (
        <Card className="text-sm text-ink-2">
          Every email is saved here as a draft. Add <code>RESEND_API_KEY</code> and a <b>Send unsent</b> button appears to send them all at
          once.
        </Card>
      )}

      {emails.length === 0 ? (
        <Card>
          <p className="font-display text-lg">No emails yet</p>
          <p className="mt-1 text-sm text-muted">They appear here when you advance a candidate to interview or reject them.</p>
        </Card>
      ) : (
        <OutboxList emails={emails} />
      )}
    </div>
  );
}
