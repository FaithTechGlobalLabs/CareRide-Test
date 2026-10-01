import type { Metadata } from "next";
import Link from "next/link";
import { acceptRide, declineRide } from "./actions";
import { ActionButton } from "@/components/action-button";
import { AutoRefresh } from "@/components/auto-refresh";
import { NeedsList, StatusBadge, TripSummary } from "@/components/ride-bits";
import { PageShell } from "@/components/site-header";
import { getBackend } from "@/lib/backend";
import { isActive } from "@/lib/rules";
import { requirePartner } from "@/lib/session";
import { formatMoney } from "@/lib/time";

export const metadata: Metadata = { title: "Ride requests" };

export default async function PartnerInbox() {
  const viewer = await requirePartner();
  const b = await getBackend();
  const [open, ours] = await Promise.all([b.listOpenRides(viewer.org_id), b.listPartnerRides(viewer.org_id)]);
  const active = ours.filter((r) => isActive(r.status));

  return (
    <PageShell viewer={viewer}>
      <AutoRefresh />
      <h1 className="text-2xl font-semibold">Ride requests</h1>
      <p className="mt-1 text-muted-foreground">
        Showing requests {viewer.org.name} can serve
        {viewer.org.offers_free && viewer.org.offers_paid ? "" : viewer.org.offers_paid ? " (paid rides)" : " (free rides)"}.
      </p>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Open requests <span className="font-normal">({open.length})</span>
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open requests right now. We&apos;ll email and text you when one comes in.</p>
        ) : (
          <ul className="space-y-3">
            {open.map((r) => (
              <li key={r.id} className="grid gap-4 rounded-xl border p-4 sm:grid-cols-[1fr_220px]">
                <div className="space-y-2">
                  <TripSummary {...r} dropoff_name={r.dropoff_name} />
                  <p className="text-sm text-muted-foreground">
                    For {r.requesting_org_name} · {r.payment_type === "paid" ? `Paid, up to ${formatMoney(r.cost_cap_cents)}` : "Free"}
                  </p>
                  <NeedsList needs={r.needs} />
                  <p className="text-xs text-muted-foreground">The rider&apos;s name and pickup notes are shared once you accept.</p>
                </div>
                <div className="space-y-2">
                  <ActionButton action={acceptRide.bind(null, r.id)}>Accept ride</ActionButton>
                  <ActionButton action={declineRide.bind(null, r.id)} variant="ghost" size="default">
                    We can&apos;t do this one
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Our rides <span className="font-normal">({active.length})</span>
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven&apos;t accepted any rides that are still in progress.</p>
        ) : (
          <ul className="space-y-2">
            {active.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/partner/rides/${r.id}`}
                  className="flex flex-col gap-2 rounded-xl border p-4 hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{r.rider?.display_name}</p>
                    <TripSummary {...r} />
                  </div>
                  <div className="flex flex-col items-start gap-1 sm:items-end">
                    <StatusBadge status={r.status} />
                    <span className="text-xs text-muted-foreground">{r.driver_name ? `Driver: ${r.driver_name}` : "Assign a driver"}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
