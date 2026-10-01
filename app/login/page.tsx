import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { demoSignIn, resetDemoData } from "@/app/auth-actions";
import { PageShell } from "@/components/site-header";
import { demoBackend } from "@/lib/backend/demo";
import { isSupabaseMode } from "@/lib/config";
import { getViewer, homeFor } from "@/lib/session";
import { MagicLinkForm } from "./magic-link-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const viewer = await getViewer();
  if (viewer) redirect(homeFor(viewer));
  const { error } = await props.searchParams;

  return (
    <PageShell viewer={null}>
      <div className="mx-auto max-w-md py-8">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        {error === "link" && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            That sign-in link has expired or was already used. Request a new one.
          </p>
        )}
        {isSupabaseMode ? <MagicLinkForm /> : <DemoPicker />}
      </div>
    </PageShell>
  );
}

async function DemoPicker() {
  const b = demoBackend();
  const profiles = await b.listProfiles();
  const orgs = await Promise.all(profiles.map((p) => b.getOrg(p.org_id)));
  const roleLabel = { staff: "Front-desk staff", coordinator: "Coordinator", partner: "Partner dispatcher" };

  return (
    <>
      <p className="mt-2 text-muted-foreground">Choose who you want to be. Everyone here is fictional.</p>
      <ul className="mt-6 space-y-2">
        {profiles.map((p, i) => (
          <li key={p.id}>
            <form action={demoSignIn.bind(null, p.id)}>
              <button className="flex w-full items-center justify-between rounded-xl border p-4 text-left hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                <span>
                  <span className="block font-medium">{p.name}</span>
                  <span className="block text-sm text-muted-foreground">{orgs[i]?.name}</span>
                </span>
                <span className="text-xs text-muted-foreground">{roleLabel[p.role]}</span>
              </button>
            </form>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">
        Drivers don&apos;t sign in. They get a text with a link to one ride. Try{" "}
        <Link className="underline" href="/d/demo-driver-sam">
          Sam&apos;s driver link
        </Link>
        .
      </p>
      <form action={resetDemoData} className="mt-6">
        <button className="text-sm text-muted-foreground underline underline-offset-4">Reset demo data</button>
      </form>
    </>
  );
}
