import type { Metadata } from "next";
import { driverStatusAction } from "./actions";
import { ActionButton } from "@/components/action-button";
import { NeedsList, StatusBadge } from "@/components/ride-bits";
import { Logo } from "@/components/site-header";
import { getBackend } from "@/lib/backend";
import { nextStatuses } from "@/lib/rules";
import { formatDateTime, formatTime } from "@/lib/time";
import { MapPin, Phone } from "lucide-react";

export const metadata: Metadata = { title: "Your ride", robots: { index: false } };

const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

// What a volunteer driver sees from the link in their text. No sign-in.
export default async function DriverPage(props: PageProps<"/d/[token]">) {
  const { token } = await props.params;
  const ride = await (await getBackend()).getDriverRide(token);

  if (!ride) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <Logo />
        <h1 className="mt-6 text-xl font-semibold">This ride link isn&apos;t active</h1>
        <p className="mt-2 text-muted-foreground">
          It may have expired, or the ride was given to another driver. Check with your dispatcher.
        </p>
      </main>
    );
  }

  const actions = nextStatuses(ride.status, "driver");

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <div className="flex items-center justify-between">
        <Logo />
        <StatusBadge status={ride.status} />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Hi {ride.driver_name}, thank you for driving for {ride.partner_name}.
      </p>
      <h1 className="mt-1 text-2xl font-semibold">
        Pick up {ride.rider_display_name}
        {ride.leg === "return" && " for the ride back"}
      </h1>
      <p className="text-lg">{formatDateTime(ride.pickup_at)}</p>

      <ol className="mt-6 space-y-4">
        <Stop label="Pick up" name={ride.pickup_name} address={ride.pickup_address} />
        <Stop
          label="Drop off"
          name={ride.dropoff_name}
          address={ride.dropoff_address}
          extra={ride.appointment_at ? `Appointment at ${formatTime(ride.appointment_at)}` : undefined}
        />
      </ol>

      <div className="mt-6 space-y-3">
        <NeedsList needs={ride.needs} empty="No special needs noted." />
        {ride.driver_notes && <p className="rounded-lg bg-muted p-3">{ride.driver_notes}</p>}
      </div>

      <div className="mt-8 space-y-3">
        {actions.includes("picked_up") && (
          <ActionButton action={driverStatusAction.bind(null, token, "picked_up")} className="[&_button]:h-14 [&_button]:text-lg">
            I&apos;ve picked them up
          </ActionButton>
        )}
        {actions.includes("dropped_off") && (
          <ActionButton action={driverStatusAction.bind(null, token, "dropped_off")} className="[&_button]:h-14 [&_button]:text-lg">
            I&apos;ve dropped them off
          </ActionButton>
        )}
        {actions.includes("no_show") && (
          <ActionButton
            action={driverStatusAction.bind(null, token, "no_show")}
            variant="outline"
            confirm="Mark that you couldn't find them? Please call the number below first."
          >
            I couldn&apos;t find them
          </ActionButton>
        )}
        {actions.length === 0 && <p className="rounded-lg bg-tone-done p-4 text-center text-tone-done-fg">All done. Thank you!</p>}
      </div>

      <a
        href={`tel:${ride.contact_phone.replace(/[^\d+]/g, "")}`}
        className="mt-8 flex items-center justify-center gap-2 rounded-xl border p-4 font-medium"
      >
        <Phone className="size-5" /> Problem? Call {ride.contact_phone}
      </a>
    </main>
  );
}

function Stop({ label, name, address, extra }: { label: string; name: string; address: string; extra?: string }) {
  return (
    <li className="rounded-xl border p-4">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-medium">{name}</p>
      <p className="text-muted-foreground">{address}</p>
      {extra && <p className="mt-1 text-sm">{extra}</p>}
      <a href={mapsUrl(address)} className="mt-2 inline-flex items-center gap-1 text-sm text-primary underline underline-offset-4">
        <MapPin className="size-4" /> Open in maps
      </a>
    </li>
  );
}
