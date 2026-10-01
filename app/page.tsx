import Link from "next/link";
import { PageShell } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getViewer, homeFor } from "@/lib/session";
import { cn } from "@/lib/utils";
import { ClipboardList, HandHeart, MapPinCheck, Printer } from "lucide-react";

const STEPS = [
  {
    icon: ClipboardList,
    title: "Staff request a ride",
    body: "In under two minutes, on behalf of someone who has no phone or data. Only a first name and initial are shared.",
  },
  {
    icon: HandHeart,
    title: "A partner accepts",
    body: "Volunteer driver programs, churches and paid partners see requests they can serve and claim them.",
  },
  {
    icon: Printer,
    title: "The person gets a ride slip",
    body: "A printed slip with the pickup time, place, and a number to call. No app needed.",
  },
  {
    icon: MapPinCheck,
    title: "Everyone sees they arrived",
    body: "Drivers tap Picked up and Dropped off from a text link. Staff confirm the person got there safely.",
  },
];

export default async function Home() {
  const viewer = await getViewer();
  return (
    <PageShell viewer={viewer}>
      <section className="py-8 sm:py-14">
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Getting people to the hospital, shelter or court date they can&apos;t afford to miss.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          CareRide helps Salvation Army staff arrange free and paid rides with partner organizations for people who
          can&apos;t book a ride themselves, and makes sure no one is left waiting.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={viewer ? homeFor(viewer) : "/login"} className={cn(buttonVariants({ size: "lg" }), "h-11 px-5 text-base")}>
            {viewer ? "Go to my rides" : "Sign in"}
          </Link>
        </div>
      </section>

      <section aria-labelledby="how" className="border-t py-8">
        <h2 id="how" className="text-lg font-semibold">
          How it works
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-xl border p-4">
              <s.icon className="size-5 text-primary" aria-hidden />
              <p className="mt-3 font-medium">
                {i + 1}. {s.title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t py-8 text-sm text-muted-foreground">
        <p>
          Built at #HACKVAN2026 with the Salvation Army Belkin Communities of Hope and FaithTech. Data stays in Canada, and
          we collect the minimum needed to get someone a ride.
        </p>
      </section>
    </PageShell>
  );
}
