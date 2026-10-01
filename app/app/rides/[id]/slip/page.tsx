import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "./print-button";
import { getBackend } from "@/lib/backend";
import { requireStaff } from "@/lib/session";
import { formatLong, formatTime } from "@/lib/time";

export const metadata: Metadata = { title: "Ride slip" };

// Plain language, large type, one page. Written for the person riding, not for staff.
export default async function RideSlip(props: PageProps<"/app/rides/[id]/slip">) {
  const viewer = await requireStaff();
  const { id } = await props.params;
  const b = await getBackend();
  const ride = await b.getRide(id);
  if (!ride || ride.org_id !== viewer.org_id) notFound();
  const returnLeg = ride.leg === "outbound" ? (await b.listOrgRides(viewer.org_id)).find((r) => r.parent_id === ride.id) : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8 print:p-0">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href={`/app/rides/${ride.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to ride
        </Link>
        <PrintButton />
      </div>

      <article className="space-y-7 rounded-2xl border-2 border-foreground p-8 text-xl leading-relaxed print:border-0 print:p-0">
        <header>
          <p className="text-base font-semibold tracking-wide uppercase">Your ride</p>
          <h1 className="text-3xl font-bold">{ride.rider?.display_name}</h1>
        </header>

        <Block label="When to be ready">
          <p className="text-3xl font-bold">{formatLong(ride.pickup_at)}</p>
          <p className="text-lg">Please be ready 10 minutes early.</p>
        </Block>

        <Block label="Where to wait">
          <p className="font-semibold">{ride.pickup_name}</p>
          <p>{ride.pickup_address}</p>
        </Block>

        <Block label="Where you are going">
          <p className="font-semibold">{ride.dropoff_name}</p>
          <p>{ride.dropoff_address}</p>
          {ride.appointment_at && <p>Your appointment is at {formatTime(ride.appointment_at)}.</p>}
        </Block>

        <Block label="Who is driving">
          <p>
            {ride.partner ? ride.partner.name : "A volunteer driver. Staff will tell you who."}
            {ride.driver_name && <>. Your driver&apos;s name is {ride.driver_name}.</>}
          </p>
        </Block>

        {returnLeg && (
          <Block label="Ride back">
            <p>
              Pickup around <span className="font-semibold">{formatLong(returnLeg.pickup_at)}</span> at {returnLeg.pickup_name}.
            </p>
          </Block>
        )}

        <Block label="Questions or running late?">
          <p>
            Call <span className="text-3xl font-bold whitespace-nowrap">{ride.contact_phone}</span>
          </p>
          <p className="text-lg">You can ask the front desk to call for you.</p>
        </Block>
      </article>
    </main>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="border-t-2 border-foreground/15 pt-5">
      <h2 className="mb-1 text-base font-semibold tracking-wide text-foreground/70 uppercase">{label}</h2>
      {children}
    </section>
  );
}
