# CareRide Platform — Website Plan

> Helping Salvation Army staff request and coordinate free and paid transportation with partner organizations, so that people without digital access can safely reach essential services like hospitals and shelters.

**Project host:** Alvin Chong, Director of Community Development, [Salvation Army Canada Belkin Communities of Hope](https://belkintsa.ca/)
**Context:** #HACKVAN2026 · FaithTech 4D Cycle (Discover → Discern → Develop → Demonstrate)
**Status:** Draft plan. Assumptions marked ⚠️ need confirming with Alvin.

---

## 1. The problem in one paragraph

Many people Belkin serves have no phone, no data plan, or no email, so they can't book a ride app, a HandyDART trip, or a taxi themselves. Today staff arrange rides by phone and memory: calling around to partners, juggling who pays, and hoping the person makes it to the appointment and back. That work is invisible, hard to hand over between shifts, and easy to drop. CareRide gives staff one place to request a ride on someone's behalf, lets partner organizations claim and fulfil it, and tracks each ride until the person has arrived safely.

**Key design consequence:** the person being driven never has to use the website. Staff are the interface. Every flow has to work for someone with no phone at all: pickup from a known location, a printed ride slip, and a staff member who can see the status.

---

## 2. People and roles

| Role | Who | What they do in CareRide |
|---|---|---|
| **Staff requester** | Belkin caseworkers, front-desk and shelter staff | Create ride requests for a person, print the ride slip, follow status, mark the outcome |
| **Coordinator** | Lead staff or a designated dispatcher | See all requests, nudge or reassign partners, approve paid rides against a budget |
| **Partner organization** | Volunteer driver programs, churches, transit/taxi partners, other agencies ⚠️ | Receive open requests that match what they can do, accept/decline, assign a driver |
| **Driver** | Volunteer or paid driver for a partner | Open a single-ride link (no account), see pickup details, mark picked up / dropped off |
| **Admin** | CareRide maintainers / Belkin IT | Manage organizations, users, saved destinations, funding sources |
| **Rider** | The person being driven | **Never logs in.** Gets a paper ride slip and is met by staff at pickup |

---

## 3. MVP scope (hackathon)

### Must have
1. **Staff sign-in** (email magic link) scoped to an organization.
2. **New ride request** wizard, under 2 minutes to fill in:
   - Rider: first name + last initial, optional callback contact (staff phone by default), language, accessibility needs (wheelchair, walker, service animal, needs escort, can't sit long).
   - Trip: pickup (defaults to the staff member's site), destination (pick from saved places such as VGH, St. Paul's or a partner shelter, or free text), appointment time, **return trip needed?**
   - Payment: **Free (volunteer)** or **Paid** → funding source + estimated cost cap.
   - Notes for driver (no clinical details. The form says so).
3. **Partner inbox**: open requests filtered by the partner's service area, vehicle capabilities, and free/paid. One-tap **Accept** / **Decline (reason)**.
4. **Driver ride link**: a tokenized URL sent by SMS/email that shows pickup, drop-off, rider first name, accessibility needs, and staff contact, with **Picked up** / **Dropped off** / **Couldn't find rider** buttons. Expires after the ride.
5. **Status timeline** on every request:
   `Requested → Accepted → Driver assigned → Picked up → Dropped off → (Return) → Completed`
   plus `Cancelled`, `No-show`, `Unfilled`.
6. **Staff dashboard**: today's and tomorrow's rides, colour-coded by status, with an alert banner for anything **unfilled within 24h of the appointment** or **not marked dropped off 30 min after the appointment**.
7. **Printable ride slip**: large type, plain language, pickup time/place, destination, driver org name, and the phone number to call (the front desk's, not the rider's). Optional QR code back to the request for staff.

### Should have
- Email + SMS notifications to partners on new matching requests (Resend + Twilio).
- Coordinator view: all rides across sites, reassign, approve paid rides.
- Saved destinations and recurring rides (e.g. weekly dialysis).
- Simple monthly report: rides requested/completed/unfilled, by destination type and free vs paid, total paid spend.

### Not now (explicitly out of scope)
- Live GPS tracking of drivers.
- In-app payments. Paid rides are tracked as approved amounts and reconciled offline.
- A rider-facing app.
- Route optimization / auto-dispatch.

---

## 4. Key screens

```
Public
  /                       Landing: what CareRide is, partner sign-up interest form
  /login                  Magic-link sign in

Staff (Belkin)
  /app                    Dashboard: today / upcoming / needs attention
  /app/rides/new          Request wizard (Rider → Trip → Payment → Review)
  /app/rides/[id]         Detail + status timeline + actions (cancel, mark no-show, rebook)
  /app/rides/[id]/slip    Printable ride slip
  /app/places             Saved destinations

Partner
  /partner                Inbox: open requests matching our capacity
  /partner/rides          Our accepted rides
  /partner/rides/[id]     Assign driver, send driver link

Driver (no account)
  /d/[token]              Single-ride view with status buttons

Admin
  /admin/orgs             Organizations, service areas, capabilities
  /admin/users            Invite / deactivate users
  /admin/funding          Funding sources and budgets
  /admin/reports          Monthly summary + CSV export
```

---

## 5. Recommended tech stack

Picked for a small volunteer team to ship in a weekend and for Belkin to keep running cheaply afterwards.

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | One codebase for pages + server actions; big volunteer talent pool |
| UI | **Tailwind CSS + shadcn/ui** | Accessible primitives, fast to build, easy to keep high-contrast |
| Database / Auth | **Supabase** (Postgres, magic-link auth, Row Level Security, Realtime) | RLS enforces "partners only see what they need" at the database layer; Canadian region (ca-central-1) for data residency |
| Notifications | **Resend** (email), **Twilio** (SMS) | Both have free/low tiers; SMS is what drivers actually read |
| Hosting | **Vercel** | Free tier, preview deploys per PR |
| Testing | Vitest (unit), Playwright (request→accept→complete happy path) | |
| CI | GitHub Actions: lint, typecheck, test on PR | |

---

## 6. Data model (first cut)

```
organizations     id, name, type (salvation_army | partner), service_area, capabilities[] (wheelchair, escort, after_hours…), offers_free, offers_paid
profiles          id (auth user), org_id, name, phone, role (staff | coordinator | partner | admin), active
riders            id, org_id, display_name ("Maria T."), language, accessibility_needs[], notes, created_by, purge_after
places            id, org_id, name, address, type (hospital | shelter | clinic | court | other)
funding_sources   id, org_id, name, monthly_budget
ride_requests     id, org_id, rider_id, pickup_place, dropoff_place, appointment_at, pickup_at,
                  needs_return, return_pickup_at, payment_type (free | paid), funding_source_id, cost_cap,
                  status, partner_org_id, driver_name, driver_phone, driver_token, driver_token_expires_at,
                  driver_notes, created_by, created_at
ride_events       id, ride_id, actor_id | 'driver', from_status, to_status, note, created_at   (append-only audit trail)
partner_responses id, ride_id, partner_org_id, response (accept | decline), reason, created_at
```

**Row Level Security sketch**
- Staff and coordinators: full access to their own org's riders and rides.
- Partners: see **open** rides matching their capabilities, and full detail **only** for rides they've accepted. Never the rider's notes or anything beyond display name + accessibility needs.
- Driver token: a server route checks token + expiry. No direct table access.

---

## 7. Dignity, privacy and safety

These come first because the people involved are vulnerable.

- **Collect the minimum.** First name + initial, no date of birth, no health card number, no diagnosis. Destination type ("hospital") is sensitive enough.
- **Consent.** Staff confirm verbally that the person agrees to their name and pickup info being shared with the partner. Store a checkbox + timestamp.
- **Retention.** Rider records and driver details are auto-purged ⚠️ 90 days after the last ride. Aggregate counts stay for reporting.
- **Canadian data residency and BC PIPA/PIPEDA alignment.** Supabase Canada region, no third-party analytics, no ad trackers.
- **Driver safety and rider safety.** Partners attest drivers are screened (criminal record check / vulnerable-sector check) ⚠️. Every ride has a "who to call" number. A ride not closed out within 30 min of appointment raises an alert to staff.
- **Accessible UI.** WCAG 2.2 AA, large tap targets, works on old phones and shared front-desk PCs, printable everything, plain language (grade 6 reading level), French + other languages for the ride slip later.
- **Language.** In the UI and code, say "person" or "rider", never "case" or "client #1234".

---

## 8. Repository layout

```
CareRide-Test/
├── README.md                 project overview, how to run, how to contribute
├── LICENSE
├── docs/
│   ├── PLAN.md               this document
│   ├── discovery/            interview notes, image-bearer profiles (FaithTech Discover)
│   └── decisions/            short ADRs (stack, privacy choices)
├── app/                      Next.js routes (see §4)
├── components/               UI components (shadcn/ui based)
├── lib/                      supabase client, status machine, notifications
├── supabase/
│   ├── migrations/           SQL schema + RLS policies
│   └── seed.sql              demo orgs, staff, partners, places, sample rides
├── tests/                    vitest + playwright
├── .github/workflows/ci.yml
└── .env.example
```

---

## 9. Build plan

### Before the hackathon (Discover / Discern)
- [ ] 30-min interview with Alvin + 2 front-line staff: walk through the last 3 rides they arranged, start to finish.
- [ ] List the actual partner organizations and what each one can do (free/paid, wheelchair, hours, area). ⚠️
- [ ] Confirm the funding model for paid rides and who approves them. ⚠️
- [ ] Agree on the MVP cut (§3) and write it into the README.
- [ ] Scaffold the repo: Next.js + Supabase + Tailwind, CI, Vercel preview, seed data.

### Hackathon Day 1
| Track | Owner | Deliverable |
|---|---|---|
| Data + auth | dev A | Migrations, RLS policies, seed data, magic-link login |
| Staff flow | dev B | Request wizard, dashboard, ride detail + timeline |
| Partner + driver flow | dev C | Partner inbox, accept/decline, driver token page |
| Design + content | designer | Ride slip, plain-language copy, accessibility pass |

### Hackathon Day 2
- Morning: notifications (email/SMS), "needs attention" alerts, printable slip.
- Midday: Playwright happy-path test, accessibility audit (axe), bug bash with seeded data.
- Afternoon: demo script (below), README, deploy to production URL.

### Demo script (3 minutes)
1. Front-desk staff creates a ride for "Maria T." to VGH at 10:30, wheelchair, needs return, free.
2. Prints the ride slip.
3. Switch to the partner view: request appears, partner accepts, assigns a volunteer driver.
4. Switch to phone: driver opens the SMS link and taps **Picked up**, then **Dropped off**.
5. Back on the staff dashboard, the timeline updates live and the ride is completed.
6. Show the "needs attention" panel catching an unfilled ride for tomorrow.

### After the hackathon
- Pilot with one Belkin site + 1–2 partners for 4 weeks.
- Weekly check-in: what broke, what staff worked around.
- Recurring rides, coordinator approvals, monthly report.

---

## 10. How we'll know it's working

**Measure**
- % of requested rides that reached the appointment (the number that matters).
- Time from request to accepted.
- Rides unfilled or no-show, and why.
- Staff-reported time spent arranging a ride, before vs after.

**Anti-metrics (don't optimize these)**
- Total rides booked. More isn't better if the rides aren't needed.
- Time on site / logins. Staff should spend *less* time in the tool.
- Rider data collected. Less is better.

---

## 11. Open questions for Alvin ⚠️

1. Which partner organizations are in scope for the pilot, and do they each have someone who'd check a web inbox?
2. Paid rides: who pays (Belkin budget, grant, partner subsidy), who approves, and is there a per-ride cap?
3. Is pickup always from a Belkin site, or sometimes from elsewhere (hospital discharge, street outreach)?
4. What do partners already require for driver screening, and what can CareRide rely on?
5. Is there existing Salvation Army policy on client data (retention, cloud hosting, consent forms) we must follow?
6. Should HandyDART / TransLink bookings be tracked here as "external" rides, even though they're booked by phone?
7. Who maintains this after the hackathon: Belkin IT, a FaithTech volunteer, or a partner?
