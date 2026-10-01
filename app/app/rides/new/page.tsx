import type { Metadata } from "next";
import { PageShell } from "@/components/site-header";
import { getBackend } from "@/lib/backend";
import { requireStaff } from "@/lib/session";
import { defaultPickupInput } from "@/lib/time";
import { RideRequestForm } from "./ride-request-form";

export const metadata: Metadata = { title: "Request a ride" };

export default async function NewRidePage() {
  const viewer = await requireStaff();
  const b = await getBackend();
  const [riders, places, funding] = await Promise.all([
    b.listRiders(viewer.org_id),
    b.listPlaces(viewer.org_id),
    b.listFundingSources(viewer.org_id),
  ]);

  return (
    <PageShell viewer={viewer}>
      <h1 className="text-2xl font-semibold">Request a ride</h1>
      <p className="mt-1 text-muted-foreground">
        For someone who can&apos;t book a ride themselves. Partners who can help are notified right away.
      </p>
      <RideRequestForm
        riders={riders}
        places={places}
        funding={funding}
        defaultPhone={viewer.org.contact_phone ?? ""}
        defaultPickup={defaultPickupInput()}
      />
    </PageShell>
  );
}
