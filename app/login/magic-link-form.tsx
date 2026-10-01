"use client";

import { useActionState } from "react";
import { sendMagicLink } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MagicLinkForm() {
  const [state, action, pending] = useActionState(sendMagicLink, undefined);
  return (
    <form action={action} className="mt-6 space-y-3">
      <Label htmlFor="email">Work email</Label>
      <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
      <Button type="submit" disabled={pending} className="h-11 w-full text-base">
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm">{state.ok}</p>}
      <p className="text-sm text-muted-foreground">No password needed. Ask your coordinator if you don&apos;t have an account yet.</p>
    </form>
  );
}
