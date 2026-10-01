import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setRideStatus } from "@/app/app/actions";
import { ActionButton } from "@/components/action-button";
import { AutoRefresh } from "@/components/auto-refresh";
import { AttentionNote, NeedsList, StatusBadge, Timeline } from "@/components/ride-bits";
import { PageShell } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getBackend } from "@/lib/backend";
import { needsAttention, nextStatuses } from "@/lib/rules";
import { requireStaff } from "@/lib/session";
import { formatDateTime, formatMoney, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { CheckCircle2, Printer } from "lucide-react";

export const metadata: Metadata = { title: "Ride" };

export default async function RidePage(props: PageProps<"/app/rides/[id]">) {
  const viewer = await requireStaff();
  const { id } = await props.params;
  const { created } = await props.searchParams;
  const b = await getBackend();
  const ride = await b.getRide(id);
  if (!ride || ride.org_id !== viewer.org_id) notFound();

  const [events, orgRides, funding] = await Promise.all([
    b.listEvents(id),
    b.listOrgRides(viewer.org_id),
    ride.funding_source_id ? b.listFundingSources(viewer.org_id) : Promise.resolve([]),
  ]);
  const linked = orgRides.find((r) => (ride.parent_id ? r.id === ride.parent_id : r.parent_id === ride.id));
  const fund = funding.find((f) => f.id === ride.funding_source_id);
  const actions = nextStatuses(ride.status, "staff");

  return (
    <PageShell viewer={viewer}>
      <AutoRefresh />
      {created && (
        <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-tone-done-fg/30 bg-tone-done p-4 text-tone-done-fg">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="size-5" /> Ride requested. Matching partners have been notified.
          </p>
          <Link href={`/app/rides/${ride.id}/slip`} className={cn(buttonVariants({ variant: "outline" }), "h-9 bg-background")}>
            <Printer /> Print ride slip
          </Link>
        </div>
      )}

      <Link href="/app" className="text-sm text-muted-foreground hover:text-foreground">
        ← All rides
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {ride.rider?.display_name ?? "Rider"}
            {ride.leg === "return" && <span className="text-muted-foreground">: return trip</span>}
          </h1>
          <p className="text-muted-foreground">
            {formatDateTime(ride.pickup_at)} · {ride.dropoff_name}
          </p>
        </div>
        <StatusBadge status={ride.status} className="px-3 py-1 text-sm" />
      </div>
      <div className="mt-2">
        <AttentionNote attention={needsAttention(ride)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card title="Trip">
            <Dl
              rows={[
                ["Pickup", `${formatDateTime(ride.pickup_at)} at ${ride.pickup_name}`, ride.pickup_address],
                ["Going to", ride.dropoff_name, ride.dropoff_address],
                ["Appointment", ride.appointment_at ? formatTime(ride.appointment_at) : "Not set"],
                ["Language", ride.rider?.language ?? "—"],
              ]}
            />
            <div className="mt-4">
              <p className="mb-1.5 text-sm text-muted-foreground">Needs</p>
              <NeedsList needs={ride.needs} />
            </div>
            {ride.driver_notes && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Notes for driver</p>
                <p className="mt-1">{ride.driver_notes}</p>
              </div>
            )}
            {linked && (
              <p className="mt-4 text-sm">
                {ride.leg === "return" ? "Outbound trip: " : "Return trip: "}
                <Link href={`/app/rides/${linked.id}`} className="underline underline-offset-4">
                  {formatDateTime(linked.pickup_at)}
                </Link>{" "}
                <StatusBadge status={linked.status} />
              </p>
            )}
          </Card>

          <Card title="Partner and driver">
            <Dl
              rows={[
                ["Partner", ride.partner?.name ?? "Waiting for a partner to accept", ride.partner?.contact_phone ?? undefined],
                ["Driver", ride.driver_name ? `${ride.driver_name}` : "Not assigned yet", ride.driver_phone ?? undefined],
                [
                  "Payment",
                  ride.payment_type === "paid" ? `Paid, up to ${formatMoney(ride.cost_cap_cents)}` : "Free",
                  fund?.name,
                ],
              ]}
            />
          </Card>

          <Card title="Timeline">
            <Timeline events={events} />
          </Card>
        </div>

        <aside className="space-y-3">
          <Link
            href={`/app/rides/${ride.id}/slip`}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 w-full")}
          >
            <Printer /> Print ride slip
          </Link>
          {actions.includes("completed") && (
            <ActionButton action={setRideStatus.bind(null, ride.id, "completed")}>They arrived safely</ActionButton>
          )}
          {actions.includes("no_show") && (
            <ActionButton
              action={setRideStatus.bind(null, ride.id, "no_show")}
              variant="outline"
              reasonLabel="What happened? (optional)"
            >
              Mark as missed pickup
            </ActionButton>
          )}
          {actions.includes("cancelled") && (
            <ActionButton
              action={setRideStatus.bind(null, ride.id, "cancelled")}
              variant="destructive"
              reasonLabel="Reason for cancelling (optional)"
              confirm="Cancel this ride? The partner and driver will be told."
            >
              Cancel ride
            </ActionButton>
          )}
        </aside>
      </div>
    </PageShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border p-5">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Dl({ rows }: { rows: [string, string, string?][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[140px_1fr]">
      {rows.map(([k, v, sub]) => (
        <div key={k} className="contents">
          <dt className="text-sm text-muted-foreground">{k}</dt>
          <dd>
            {v}
            {sub && <span className="block text-sm text-muted-foreground">{sub}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
