import Link from "next/link";
import { signOut } from "@/app/auth-actions";
import { isSupabaseMode } from "@/lib/config";
import { isStaff, type Viewer } from "@/lib/session";
import { Car } from "lucide-react";

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
        <Car className="size-4" aria-hidden />
      </span>
      CareRide
    </span>
  );
}

export function SiteHeader({ viewer }: { viewer: Viewer | null }) {
  const nav = viewer
    ? isStaff(viewer)
      ? [
          { href: "/app", label: "Rides" },
          { href: "/app/rides/new", label: "Request a ride" },
        ]
      : [{ href: "/partner", label: "Ride requests" }]
    : [];
  if (viewer && !isSupabaseMode) nav.push({ href: "/messages", label: "Message log" });

  return (
    <header className="no-print border-b bg-background">
      {!isSupabaseMode && (
        <p className="bg-tone-waiting px-4 py-1 text-center text-xs text-tone-waiting-fg">
          Demo mode: fictional data, resets when the server restarts. No real messages are sent.
        </p>
      )}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href={viewer ? (isStaff(viewer) ? "/app" : "/partner") : "/"} aria-label="CareRide home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex flex-wrap gap-4 text-sm">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-muted-foreground hover:text-foreground">
              {n.label}
            </Link>
          ))}
        </nav>
        {viewer && (
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {viewer.name} · {viewer.org.name}
            </span>
            <form action={signOut}>
              <button className="underline-offset-4 hover:underline">Sign out</button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}

export function PageShell({ viewer, children }: { viewer: Viewer | null; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader viewer={viewer} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
