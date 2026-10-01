"use client";

import { startTransition, useActionState } from "react";
import { assignDriverAction } from "../../actions";
import { Button } from "@/components/ui/button";

const field = "h-11 w-full rounded-lg border border-input bg-background px-3 text-base";

export function AssignDriverForm({ rideId, defaultName, defaultPhone }: { rideId: string; defaultName: string; defaultPhone: string }) {
  const [state, action, pending] = useActionState(assignDriverAction.bind(null, rideId), undefined);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <div>
        <label htmlFor="driver_name" className="mb-1.5 block text-sm font-medium">
          Driver&apos;s first name
        </label>
        <input id="driver_name" name="driver_name" className={field} defaultValue={defaultName} maxLength={60} required />
      </div>
      <div>
        <label htmlFor="driver_phone" className="mb-1.5 block text-sm font-medium">
          Driver&apos;s mobile
        </label>
        <input id="driver_phone" name="driver_phone" type="tel" className={field} defaultValue={defaultPhone} required />
      </div>
      <Button type="submit" disabled={pending} className="h-10 w-full">
        {pending ? "Sending…" : defaultName ? "Change driver and send link" : "Assign and text the driver"}
      </Button>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-tone-done-fg">Driver texted.</p>}
    </form>
  );
}
