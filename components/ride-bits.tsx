import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_TONE, type Attention } from "@/lib/rules";
import { formatDateTime, formatTime } from "@/lib/time";
import { NEED_LABELS, type Need, type RideEvent, type RideStatus } from "@/lib/types";
import { AlertTriangle, Clock } from "lucide-react";

const TONE_CLASSES = {
  waiting: "bg-tone-waiting text-tone-waiting-fg",
  progress: "bg-tone-progress text-tone-progress-fg",
  done: "bg-tone-done text-tone-done-fg",
  stopped: "bg-tone-stopped text-tone-stopped-fg",
};

export function StatusBadge({ status, className }: { status: RideStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        TONE_CLASSES[STATUS_TONE[status]],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function AttentionNote({ attention }: { attention: Attention | null }) {
  if (!attention) return null;
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-sm font-medium",
        attention.level === "urgent" ? "text-destructive" : "text-tone-waiting-fg",
      )}
    >
      {attention.level === "urgent" ? <AlertTriangle className="size-4" /> : <Clock className="size-4" />}
      {attention.reason}
    </p>
  );
}

export function NeedsList({ needs, empty = "No special needs" }: { needs: Need[]; empty?: string }) {
  if (needs.length === 0) return <span className="text-muted-foreground">{empty}</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {needs.map((n) => (
        <li key={n} className="rounded-md border px-2 py-0.5 text-xs">
          {NEED_LABELS[n]}
        </li>
      ))}
    </ul>
  );
}

export function Timeline({ events }: { events: RideEvent[] }) {
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-primary ring-4 ring-background" />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <StatusBadge status={e.to_status} />
            <span className="text-sm">{e.actor_name}</span>
            <time className="text-xs text-muted-foreground" dateTime={e.created_at} title={formatDateTime(e.created_at)}>
              {formatDateTime(e.created_at)}
            </time>
          </div>
          {e.note && <p className="mt-1 text-sm text-muted-foreground">{e.note}</p>}
        </li>
      ))}
    </ol>
  );
}

export function TripSummary({
  pickup_at,
  appointment_at,
  pickup_name,
  dropoff_name,
  leg,
}: {
  pickup_at: string;
  appointment_at: string | null;
  pickup_name: string;
  dropoff_name: string;
  leg: "outbound" | "return";
}) {
  return (
    <div className="space-y-0.5">
      <p className="font-semibold">
        {formatDateTime(pickup_at)}
        {appointment_at && <span className="font-normal text-muted-foreground"> · appointment {formatTime(appointment_at)}</span>}
        {leg === "return" && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">Return trip</span>}
      </p>
      <p className="text-sm">
        {pickup_name} <span aria-hidden>→</span>
        <span className="sr-only">to</span> {dropoff_name}
      </p>
    </div>
  );
}
