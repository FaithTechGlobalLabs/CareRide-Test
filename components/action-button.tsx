"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/actor";
import { cn } from "@/lib/utils";

type Props = {
  action: (prev: ActionResult, data: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost";
  confirm?: string;
  /** Optional free-text reason collected with the action. */
  reasonLabel?: string;
  className?: string;
  size?: "default" | "lg";
};

/** A single-button form for a server action, with pending state and inline errors. */
export function ActionButton({ action, children, variant = "default", confirm, reasonLabel, className, size = "lg" }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className={cn("space-y-2", className)}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {reasonLabel && (
        <input
          name="reason"
          aria-label={reasonLabel}
          placeholder={reasonLabel}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
        />
      )}
      <Button type="submit" variant={variant} size={size} disabled={pending} className="h-10 w-full px-4 text-sm">
        {pending ? "Saving…" : children}
      </Button>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
