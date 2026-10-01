import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { partnerStatusAction, releaseRide } from "../../actions";
import { AssignDriverForm } from "./assign-driver-form";
import { ActionButton } from "@/components/action-button";
import { NeedsList, StatusBadge, Timeline } from "@/components/ride-bits";
import { PageShell } from "@/components/site-header";
import { getBackend } from "@/lib/backend";
import { nextStatuses } from "@/lib/rules";
import { requirePartner } from "@/lib/session";
import { formatDateTime, formatMoney, formatTime } from "@/lib/time";

export const metadata: Metadata = { title: "Ride" };

export default async function PartnerRidePage(props: PageProps<"/partner/rides/[id]">) {
  const viewer = await requirePartner();
  const { id } = await props.params;
  const b = await getBackend();
  const ride = await b.getRide(id);
  if (!ride || ride.partner_org_id !== viewer.org_id) notFound();
  const events = await b.listEvents(id);
  const actions = nextStatuses(ride.status, "partner");
  const canAssign = ride.status === "accepted" || ride.status === "driver_assigned";

  return (
    <PageShell viewer={viewer}>
      <Link href="/partner" className="text-sm text-muted-foreground hover:text-foreground">
        ← Ride requests
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{ride.rider?.display_name}</h1>
          <p className="text-muted-foreground">
            For {ride.requesting_org.name} · {formatDateTime(ride.pickup_at)}
          </p>
        </div>
        <StatusBadge status={ride.status} className="px-3 py-1 text-sm" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="space-y-4 rounded-xl border p-5">
            <h2 className="font-semibold">Trip</h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[140px_1fr]">
              <dt className="text-sm text-muted-foreground">Pickup</dt>
              <dd>
                {formatDateTime(ride.pickup_at)} at {ride.pickup_name}
                <span className="block text-sm text-muted-foreground">{ride.pickup_address}</span>
              </dd>
              <dt className="text-sm text-muted-foreground">Drop off</dt>
              <dd>
                {ride.dropoff_name}
                <span className="block text-sm text-muted-foreground">{ride.dropoff_address}</span>
              </dd>
              <dt className="text-sm text-muted-foreground">Appointment</dt>
              <dd>{ride.appointment_at ? formatTime(ride.appointment_at) : "Not set"}</dd>
              <dt className="text-sm text-muted-foreground">Language</dt>
              <dd>{ride.rider?.language}</dd>
              <dt className="text-sm text-muted-foreground">Payment</dt>
              <dd>{ride.payment_type === "paid" ? `Paid, up to ${formatMoney(ride.cost_cap_cents)}` : "Free"}</dd>
              <dt className="text-sm text-muted-foreground">Questions</dt>
              <dd>Call {ride.contact_phone}</dd>
            </dl>
            <NeedsList needs={ride.needs} />
            {ride.driver_notes && <p className="rounded-lg bg-muted p-3 text-sm">{ride.driver_notes}</p>}
          </section>
          <section className="rounded-xl border p-5">
            <h2 className="mb-4 font-semibold">Timeline</h2>
            <Timeline events={events} />
          </section>
        </div>

        <aside className="space-y-6">
          {canAssign && (
            <section className="space-y-3 rounded-xl border p-5">
              <h2 className="font-semibold">{ride.driver_name ? `Driver: ${ride.driver_name}` : "Assign a driver"}</h2>
              <p className="text-sm text-muted-foreground">
                {ride.driver_name
                  ? "Change the driver if plans change. The new driver gets a fresh link and the old one stops working."
                  : "We'll text them a link with the pickup details. No app or account needed."}
              </p>
              <AssignDriverForm rideId={ride.id} defaultName={ride.driver_name ?? ""} defaultPhone={ride.driver_phone ?? ""} />
            </section>
          )}
          {(actions.includes("picked_up") || actions.includes("dropped_off") || actions.includes("no_show")) && (
            <section className="space-y-2 rounded-xl border p-5">
              <h2 className="font-semibold">Update for your driver</h2>
              {actions.includes("picked_up") && (
                <ActionButton action={partnerStatusAction.bind(null, ride.id, "picked_up")}>Picked up</ActionButton>
              )}
              {actions.includes("dropped_off") && (
                <ActionButton action={partnerStatusAction.bind(null, ride.id, "dropped_off")}>Dropped off</ActionButton>
              )}
              {actions.includes("no_show") && (
                <ActionButton action={partnerStatusAction.bind(null, ride.id, "no_show")} variant="outline">
                  Couldn&apos;t find the rider
                </ActionButton>
              )}
            </section>
          )}
          {actions.includes("requested") && (
            <ActionButton
              action={releaseRide.bind(null, ride.id)}
              variant="destructive"
              reasonLabel="Why? (optional)"
              confirm="Hand this ride back? Staff will be told and other partners can take it."
            >
              We can&apos;t do this ride anymore
            </ActionButton>
          )}
        </aside>
      </div>
    </PageShell>
  );
}
