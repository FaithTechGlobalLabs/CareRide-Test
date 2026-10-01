import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { AttentionNote, StatusBadge, TripSummary } from "@/components/ride-bits";
import { PageShell } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getBackend } from "@/lib/backend";
import { isActive, needsAttention, type Attention } from "@/lib/rules";
import { requireStaff } from "@/lib/session";
import type { RideView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export const metadata: Metadata = { title: "Rides" };

export default async function StaffDashboard() {
  const viewer = await requireStaff();
  const rides = await (await getBackend()).listOrgRides(viewer.org_id);
  const now = new Date();

  const withAttention = rides.map((r) => ({ ride: r, attention: needsAttention(r, now) }));
  const attention = withAttention
    .filter((x) => x.attention)
    .sort((a, b) => (a.attention!.level === b.attention!.level ? 0 : a.attention!.level === "urgent" ? -1 : 1));
  const flagged = new Set(attention.map((x) => x.ride.id));
  const upcoming = withAttention.filter((x) => isActive(x.ride.status) && !flagged.has(x.ride.id));
  const recent = rides
    .filter((r) => !isActive(r.status) && now.getTime() - new Date(r.pickup_at).getTime() < 3 * 864e5)
    .reverse();

  return (
    <PageShell viewer={viewer}>
      <AutoRefresh />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Rides</h1>
        <Link href="/app/rides/new" className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}>
          <Plus /> Request a ride
        </Link>
      </div>

      <Section title="Needs attention" count={attention.length} empty="Nothing needs attention right now.">
        {attention.map(({ ride, attention }) => (
          <RideRow key={ride.id} ride={ride} attention={attention} />
        ))}
      </Section>

      <Section title="Upcoming and in progress" count={upcoming.length} empty="No other rides scheduled.">
        {upcoming.map(({ ride }) => (
          <RideRow key={ride.id} ride={ride} attention={null} />
        ))}
      </Section>

      <Section title="Finished in the last 3 days" count={recent.length} empty="No finished rides yet.">
        {recent.map((ride) => (
          <RideRow key={ride.id} ride={ride} attention={null} />
        ))}
      </Section>
    </PageShell>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title} <span className="font-normal">({count})</span>
      </h2>
      {count === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : <ul className="space-y-2">{children}</ul>}
    </section>
  );
}

function RideRow({ ride, attention }: { ride: RideView; attention: Attention | null }) {
  return (
    <li>
      <Link
        href={`/app/rides/${ride.id}`}
        className={cn(
          "flex flex-col gap-2 rounded-xl border p-4 hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between",
          attention?.level === "urgent" && "border-destructive/40 bg-destructive/5",
        )}
      >
        <div className="space-y-1">
          <p className="text-sm font-medium">{ride.rider?.display_name ?? "Rider"}</p>
          <TripSummary {...ride} />
          <AttentionNote attention={attention} />
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <StatusBadge status={ride.status} />
          <span className="text-xs text-muted-foreground">
            {ride.partner?.name ?? "No partner yet"} · {ride.payment_type === "paid" ? "Paid" : "Free"}
          </span>
        </div>
      </Link>
    </li>
  );
}
