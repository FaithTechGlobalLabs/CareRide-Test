# CareRide

Helping Salvation Army staff request and coordinate free and paid transportation with partner organizations, so that people without digital access can safely reach essential services like hospitals and shelters.

![MIT License](https://badgen.net/badge/license/MIT/blue)
![Discover](https://badgen.net/badge/stage/discover/orange)

<!--
Other 4D cycle badges
![Discern](https://badgen.net/badge/stage/discern/gray)
![Develop](https://badgen.net/badge/stage/develop/blue)
![Demonstrate](https://badgen.net/badge/stage/demonstrate/green)
-->

**Project host:** Alvin Chong, Director of Community Development, [Salvation Army Belkin Communities of Hope](https://belkintsa.ca/) · #HACKVAN2026

## Overview

Many people Belkin serves have no phone, data or email, so they can't book a ride themselves. Staff arrange rides for them by phone and memory, and it's easy for a ride to fall through. CareRide gives staff one place to do it:

1. **Staff request a ride** on someone's behalf in under two minutes, sharing only a first name and last initial.
2. **Matching partners are notified** by email and text, then accept from their inbox. Matching considers wheelchair access, escorts, and free or paid.
3. **The partner assigns a driver**, who gets a text with a one-ride link. No account or app is needed.
4. **The person gets a printed ride slip** with the time, place and a number to call.
5. **The driver taps Picked up and Dropped off**, and **staff confirm the person arrived safely**.
6. The dashboard flags anything that needs a person to step in: no partner yet, no driver close to pickup, or not dropped off after the appointment.

See [docs/PLAN.md](docs/PLAN.md) for the full plan, and [docs/1_discover](docs/1_discover) for the FaithTech Discover work.

> **Prototype status:** this is a hackathon prototype. Partner organizations, people and phone numbers in the demo data are fictional. The Discover phase isn't complete yet; see the open questions in the plan.

## 📋 Requirements

- [Bun](https://bun.sh) 1.3+ (or Node.js 20.9+ with npm)
- Optional: a [Supabase](https://supabase.com) project in **Canada (Central)**, plus [Resend](https://resend.com) and [Twilio](https://twilio.com) accounts

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 + shadcn/ui · Supabase (Postgres + Row Level Security + magic-link auth) · Resend · Twilio · Vercel

## 🚀 Getting Started

### Demo mode (no setup)

```bash
bun install
bun --bun run dev
```

Open http://localhost:3000 and choose a person to sign in as:

- **Dana** (Belkin front desk): request a ride, print the slip, confirm arrival
- **Marcus** (Grace Church Care Van) or **Priya** (Hope Rides): accept rides and assign drivers
- **Jordan** (Metro Accessible Cabs): takes paid, wheelchair-accessible rides

Drivers don't sign in. Try `/d/demo-driver-sam`, or open the **Message log** to find the link a driver was texted. Demo data lives in memory and resets when the server restarts.

### Supabase mode

1. Create a Supabase project in **ca-central-1**.
2. Run `supabase/migrations/20261001000000_init.sql`, then `supabase/seed.sql` (replace the fictional partners with real ones).
3. Invite staff and partners under **Authentication → Users**, then add a `profiles` row for each one (example in `seed.sql`).
4. Add `/auth/callback` to the allowed redirect URLs.
5. Copy `.env.example` to `.env.local` and fill in the Supabase URL and anon key. Add Resend and Twilio keys to send real messages.

### Checks

```bash
bun run lint && bun run typecheck
bun run test       # ride rules, time zones, full ride lifecycle on the demo store
bun run test:db    # runs the real migration in PGlite and checks RLS as staff, partners and drivers
bun --bun run build
```

### Deploying to Vercel

Import the repo, set the environment variables from `.env.example`, and deploy. Demo mode on Vercel works for a quick look, but its in-memory data isn't shared between server instances, so use Supabase for anything real.

## How it's built

| Path | What's there |
|---|---|
| `lib/rules.ts` | Who may move a ride between statuses, partner matching, "needs attention" rules |
| `lib/rides.ts` | Ride workflows (request, accept, assign driver, driver updates) and notifications |
| `lib/backend/` | Storage interface with two implementations: `demo.ts` (in-memory) and `supabase.ts` |
| `supabase/migrations/` | Schema, RLS policies, and SQL functions for the partner inbox, accepting, handing back, and driver links |
| `app/app/` | Staff: dashboard, request form, ride detail, printable slip |
| `app/partner/` | Partners: inbox, ride detail, assign driver |
| `app/d/[token]/` | Driver's one-ride page |

**Privacy by design:**
- Riders are stored as a first name and last initial only.
- Partners see open requests without the rider's name or notes until they accept.
- Partners can't change trip details.
- Driver links expire 12 hours after pickup and stop working if the driver is changed.
- Texts and emails never include the rider's name.

## 🗓️ How to Participate

- We chat async on FaithTech Slack | [#prj-our-project][slack]
- We meet online every Thursday at 4PM ET | [conference link][online-meeting]
- We meet in-person every third Thursday of the month | [events calendar][inperson-meeting]

[online-meeting]: https://zoom.us/
[inperson-meeting]: https://faithtech.com/events/
[slack]: https://faithtechhub.slack.com/archives/C7R5FM25B

## 👏 How to Contribute

Pick an open question or a "Should have" item from [docs/PLAN.md](docs/PLAN.md), open a branch, and send a PR. CI runs lint, typecheck, unit tests, the database checks and a build.

### [Code of Conduct][code]

We have adopted a Code of Conduct that we expect project participants to adhere to.
Please read the [full text][code] so that you can understand what actions will and will not be tolerated.

[code]: https://github.com/FaithTechGlobalLabs/.github/blob/main/CODE_OF_CONDUCT.md

## Team Members
* [josephchua](https://github.com/josephchua)
* [winlaif](https://github.com/winlaif)

## 📄 License

Project is MIT licensed, as found in the [LICENSE][license] file.

[license]: ./LICENSE
