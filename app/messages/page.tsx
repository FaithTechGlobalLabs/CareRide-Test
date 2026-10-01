import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageShell } from "@/components/site-header";
import { demoBackend } from "@/lib/backend/demo";
import { isSupabaseMode } from "@/lib/config";
import { getViewer } from "@/lib/session";
import { formatDateTime } from "@/lib/time";
import { Mail, MessageSquare } from "lucide-react";

export const metadata: Metadata = { title: "Message log" };

// Demo only: the emails and texts CareRide would have sent.
export default async function MessagesPage() {
  if (isSupabaseMode) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const messages = await demoBackend().listMessages();

  return (
    <PageShell viewer={viewer}>
      <AutoRefresh seconds={10} />
      <h1 className="text-2xl font-semibold">Message log</h1>
      <p className="mt-1 text-muted-foreground">
        Emails and texts CareRide would send. In demo mode nothing actually goes out.
      </p>
      {messages.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No messages yet. Request or accept a ride to see some.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {messages.map((m) => (
            <li key={m.id} className="rounded-xl border p-4">
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {m.channel === "email" ? <Mail className="size-4" /> : <MessageSquare className="size-4" />}
                <span className="font-medium text-foreground">{m.to}</span>
                <span>· {formatDateTime(m.created_at)}</span>
                {!m.delivered && <span className="rounded bg-muted px-1.5 text-xs">not sent</span>}
              </p>
              {m.subject && <p className="mt-2 font-medium">{m.subject}</p>}
              <p className="mt-1 text-sm whitespace-pre-line">{m.body}</p>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
