"use client";

import { startTransition, useActionState, useState } from "react";
import { requestRide } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/time";
import { NEED_LABELS, NEEDS, type FundingSource, type Need, type Place, type Rider } from "@/lib/types";
import { cn } from "@/lib/utils";

const field =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const labelCls = "mb-1.5 block text-sm font-medium";
const hint = "mt-1 text-sm text-muted-foreground";

type Props = {
  riders: Rider[];
  places: Place[];
  funding: FundingSource[];
  defaultPhone: string;
  defaultPickup: string;
};

export function RideRequestForm({ riders, places, funding, defaultPhone, defaultPickup }: Props) {
  const [state, formAction, pending] = useActionState(requestRide, undefined);
  const [riderId, setRiderId] = useState("new");
  const [needs, setNeeds] = useState<Need[]>([]);
  const [pickupPlace, setPickupPlace] = useState(places.find((p) => p.type === "office")?.id ?? "other");
  const [dropoffPlace, setDropoffPlace] = useState(places.find((p) => p.type === "hospital")?.id ?? "other");
  const [needsReturn, setNeedsReturn] = useState(false);
  const [payment, setPayment] = useState<"free" | "paid">("free");

  const chooseRider = (id: string) => {
    setRiderId(id);
    setNeeds(riders.find((r) => r.id === id)?.needs ?? []);
  };

  return (
    <form
      className="mt-6 max-w-2xl space-y-8"
      // Submit manually so the form keeps what was typed if there's an error.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      <Fieldset legend="1. Who is riding">
        <div>
          <label htmlFor="rider_id" className={labelCls}>
            Person
          </label>
          <select id="rider_id" name="rider_id" className={field} value={riderId} onChange={(e) => chooseRider(e.target.value)}>
            <option value="new">Someone new…</option>
            {riders.map((r) => (
              <option key={r.id} value={r.id}>
                {r.display_name}
              </option>
            ))}
          </select>
        </div>
        {riderId === "new" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="rider_name" className={labelCls}>
                First name and last initial
              </label>
              <input id="rider_name" name="rider_name" className={field} placeholder="Maria T." maxLength={40} required />
              <p className={hint}>Nothing more. No full names, birthdays or health numbers.</p>
            </div>
            <div>
              <label htmlFor="rider_language" className={labelCls}>
                Language
              </label>
              <input id="rider_language" name="rider_language" className={field} defaultValue="English" maxLength={40} />
            </div>
          </div>
        )}
        {riderId !== "new" && (
          <>
            <input type="hidden" name="rider_name" value="" />
            <input type="hidden" name="rider_language" value="" />
          </>
        )}
        <fieldset>
          <legend className={labelCls}>What do they need on this trip?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {NEEDS.map((n) => (
              <label key={n} className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary/5">
                <input
                  type="checkbox"
                  name="needs"
                  value={n}
                  checked={needs.includes(n)}
                  onChange={(e) => setNeeds((cur) => (e.target.checked ? [...cur, n] : cur.filter((x) => x !== n)))}
                  className="size-4 accent-primary"
                />
                {NEED_LABELS[n]}
              </label>
            ))}
          </div>
        </fieldset>
      </Fieldset>

      <Fieldset legend="2. The trip">
        <PlacePicker
          prefix="pickup"
          label="Pick up from"
          places={places}
          value={pickupPlace}
          onChange={setPickupPlace}
        />
        <PlacePicker
          prefix="dropoff"
          label="Going to"
          places={places}
          value={dropoffPlace}
          onChange={setDropoffPlace}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pickup_at" className={labelCls}>
              Pickup time
            </label>
            <input id="pickup_at" name="pickup_at" type="datetime-local" className={field} defaultValue={defaultPickup} required />
          </div>
          <div>
            <label htmlFor="appointment_at" className={labelCls}>
              Appointment time <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input id="appointment_at" name="appointment_at" type="datetime-local" className={field} />
          </div>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" checked={needsReturn} onChange={(e) => setNeedsReturn(e.target.checked)} className="size-4 accent-primary" />
          They need a ride back too
        </label>
        {needsReturn ? (
          <div className="sm:w-1/2">
            <label htmlFor="return_pickup_at" className={labelCls}>
              Return pickup time
            </label>
            <input id="return_pickup_at" name="return_pickup_at" type="datetime-local" className={field} required />
            <p className={hint}>Best guess is fine. Staff can update it later.</p>
          </div>
        ) : (
          <input type="hidden" name="return_pickup_at" value="" />
        )}
      </Fieldset>

      <Fieldset legend="3. Who pays">
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["free", "Free", "A volunteer or church partner"],
              ["paid", "Paid", "From one of our transportation funds"],
            ] as const
          ).map(([value, title, desc]) => (
            <label key={value} className="flex items-start gap-3 rounded-lg border p-3 has-checked:border-primary has-checked:bg-primary/5">
              <input
                type="radio"
                name="payment_type"
                value={value}
                checked={payment === value}
                onChange={() => setPayment(value)}
                className="mt-1 size-4 accent-primary"
              />
              <span>
                <span className="block font-medium">{title}</span>
                <span className="block text-sm text-muted-foreground">{desc}</span>
              </span>
            </label>
          ))}
        </div>
        {payment === "paid" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="funding_source_id" className={labelCls}>
                Fund
              </label>
              <select id="funding_source_id" name="funding_source_id" className={field} required>
                {funding.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({formatMoney(f.monthly_budget_cents)}/month)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cost_cap" className={labelCls}>
                Most this ride may cost (CAD)
              </label>
              <input id="cost_cap" name="cost_cap" inputMode="decimal" className={field} placeholder="40.00" required />
            </div>
          </div>
        ) : (
          <>
            <input type="hidden" name="funding_source_id" value="" />
            <input type="hidden" name="cost_cap" value="" />
          </>
        )}
      </Fieldset>

      <Fieldset legend="4. For the driver">
        <div>
          <label htmlFor="driver_notes" className={labelCls}>
            Notes for the driver <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="driver_notes"
            name="driver_notes"
            rows={3}
            maxLength={500}
            className={cn(field, "h-auto py-2")}
            placeholder="Which entrance, where they'll wait, anything that helps the pickup go smoothly."
          />
          <p className={hint}>Practical details only. Don&apos;t include diagnoses or why they&apos;re going.</p>
        </div>
        <div className="sm:w-1/2">
          <label htmlFor="contact_phone" className={labelCls}>
            Number to call about this ride
          </label>
          <input id="contact_phone" name="contact_phone" type="tel" className={field} defaultValue={defaultPhone} required />
          <p className={hint}>Usually the front desk. It goes on the ride slip and the driver&apos;s screen.</p>
        </div>
      </Fieldset>

      <label className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
        <input type="checkbox" name="consent" className="mt-0.5 size-4 accent-primary" required />
        <span>
          I asked this person and they agreed to share their first name, pickup and destination with the ride partner and
          driver.
        </span>
      </label>

      {state?.error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="h-12 w-full text-base sm:w-auto sm:px-8">
        {pending ? "Sending request…" : "Request ride"}
      </Button>
    </form>
  );
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-2 text-lg font-semibold">{legend}</legend>
      {children}
    </fieldset>
  );
}

function PlacePicker({
  prefix,
  label,
  places,
  value,
  onChange,
}: {
  prefix: "pickup" | "dropoff";
  label: string;
  places: Place[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${prefix}_place_id`} className={labelCls}>
          {label}
        </label>
        <select id={`${prefix}_place_id`} name={`${prefix}_place_id`} className={field} value={value} onChange={(e) => onChange(e.target.value)}>
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="other">Somewhere else…</option>
        </select>
      </div>
      {value === "other" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <input name={`${prefix}_name`} aria-label={`${label}: place name`} placeholder="Place name" className={field} required />
          <input name={`${prefix}_address`} aria-label={`${label}: address`} placeholder="Street address" className={field} required />
        </div>
      ) : (
        <>
          <input type="hidden" name={`${prefix}_name`} value="" />
          <input type="hidden" name={`${prefix}_address`} value="" />
        </>
      )}
    </div>
  );
}
