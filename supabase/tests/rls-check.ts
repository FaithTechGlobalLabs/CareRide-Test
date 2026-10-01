import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "fs";
import { join } from "path";

// Runs the real migration in an in-process Postgres (PGlite) with a stand-in for
// Supabase's auth schema, then checks Row Level Security and the SQL functions
// as staff, partners and anonymous drivers would hit them. Run: bun run test:db
const repo = join(import.meta.dir, "..", "..");
const db = new PGlite();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const q = async (sql: string, params: unknown[] = []) => (await db.query<Row>(sql, params)).rows;
let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : " " + JSON.stringify(detail)}`); if (!ok) failures++; };

// Minimal stand-in for Supabase's auth schema and roles.
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
`);
await db.exec(readFileSync(`${repo}/supabase/migrations/20261001000000_init.sql`, "utf8"));
await db.exec(`grant usage on schema public to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);
await db.exec(readFileSync(`${repo}/supabase/seed.sql`, "utf8"));
const BELKIN = "00000000-0000-0000-0000-00000000b001", HOPE = "00000000-0000-0000-0000-00000000a001", VAN = "00000000-0000-0000-0000-00000000a002";
const DANA = "11111111-1111-1111-1111-111111111111", MARCUS = "22222222-2222-2222-2222-222222222222", PRIYA = "33333333-3333-3333-3333-333333333333";
await db.exec(`
  insert into auth.users values ('${DANA}','dana@x.org'),('${MARCUS}','marcus@x.org'),('${PRIYA}','priya@x.org');
  insert into profiles values ('${DANA}','${BELKIN}','Dana','dana@x.org',null,'staff'),
    ('${MARCUS}','${VAN}','Marcus','marcus@x.org',null,'partner'),
    ('${PRIYA}','${HOPE}','Priya','priya@x.org',null,'partner');`);

async function as<T>(user: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(user ? `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);` : `set role anon; select set_config('request.jwt.claim.sub','',false);`);
  try { return await fn(); } finally { await db.exec(`reset role;`); }
}
const expectError = async (name: string, fn: () => Promise<unknown>) => {
  try { await fn(); check(name, false, "no error"); } catch { check(name, true); }
};

// Staff create a rider and a wheelchair ride.
const rideId = await as(DANA, async () => {
  const [rider] = await q(`insert into riders (org_id, display_name, needs) values ($1,'Lee W.','{wheelchair}') returning id`, [BELKIN]);
  const [ride] = await q(`insert into ride_requests (org_id, rider_id, pickup_name, pickup_address, dropoff_name, dropoff_address, pickup_at, needs, payment_type, contact_phone, consent_at, created_by, driver_notes)
    values ($1,$2,'Belkin','555 Homer','VGH','920 W 10th', now() + interval '1 day', '{wheelchair}', 'free', '604-555-0100', now(), $3, 'Side door') returning id`, [BELKIN, rider.id, DANA]);
  await q(`insert into ride_events (ride_id, actor_kind, actor_name, to_status) values ($1,'staff','Dana','requested')`, [ride.id]);
  return ride.id as string;
});
check("staff can create rides", !!rideId);
await expectError("staff can't create rides for another org", () => as(DANA, () => q(`insert into riders (org_id, display_name) values ($1,'X Y.')`, [VAN])));

// Partner visibility before accepting.
const priyaOpen = await as(PRIYA, () => q(`select * from open_rides_for_partner()`));
check("non-matching partner doesn't see the request", priyaOpen.length === 0, priyaOpen);
const vanOpen = await as(MARCUS, () => q(`select * from open_rides_for_partner()`));
check("matching partner sees the request", vanOpen.length === 1);
check("open request hides rider name and notes", !JSON.stringify(vanOpen).includes("Lee W.") && !JSON.stringify(vanOpen).includes("Side door"));
check("partner can't read the ride row before accepting", (await as(MARCUS, () => q(`select id from ride_requests`))).length === 0);
check("partner can't read riders before accepting", (await as(MARCUS, () => q(`select id from riders`))).length === 0);
check("non-matching partner can't accept", (await as(PRIYA, () => q(`select accept_ride($1,'Priya') as ok`, [rideId])))[0].ok === false);

// Accept, then see details.
check("matching partner accepts", (await as(MARCUS, () => q(`select accept_ride($1,'Marcus') as ok`, [rideId])))[0].ok === true);
check("second accept fails", (await as(MARCUS, () => q(`select accept_ride($1,'Marcus') as ok`, [rideId])))[0].ok === false);
check("partner now reads the ride and rider", (await as(MARCUS, () => q(`select r.id, rd.display_name from ride_requests r join riders rd on rd.id = r.rider_id`)))[0]?.display_name === "Lee W.");
check("other partner still can't read it", (await as(PRIYA, () => q(`select id from ride_requests`))).length === 0);
await expectError("partner can't change trip details", () => as(MARCUS, () => q(`update ride_requests set pickup_name = 'Elsewhere' where id = $1`, [rideId])));

// Assign driver, then the driver works the ride with no account.
await as(MARCUS, () => q(`update ride_requests set status='driver_assigned', driver_name='Esther', driver_phone='604-555-0199', driver_token='tok123', driver_token_expires_at = now() + interval '2 days' where id = $1`, [rideId]));
const dr = (await as(null, () => q(`select driver_ride('tok123') as r`)))[0].r;
check("driver link shows the ride", dr?.rider_display_name === "Lee W." && dr?.status === "driver_assigned", dr);
check("bad token shows nothing", (await as(null, () => q(`select driver_ride('nope') as r`)))[0].r === null);
const skip = (await as(null, () => q(`select driver_set_status('tok123','dropped_off') as r`)))[0].r;
check("driver can't skip pickup", skip.ok === false, skip);
const up = (await as(null, () => q(`select driver_set_status('tok123','picked_up') as r`)))[0].r;
check("driver marks picked up", up.ok === true, up);
const down = (await as(null, () => q(`select driver_set_status('tok123','dropped_off') as r`)))[0].r;
check("driver marks dropped off and server gets notify email", down.ok === true && down.notify_email === "frontdesk@belkin.example", down);
check("anon can't read tables directly", (await as(null, () => q(`select id from ride_requests`))).length === 0);

// Staff confirm arrival; timeline is complete.
await as(DANA, () => q(`update ride_requests set status='completed' where id=$1`, [rideId]));
const events = await as(DANA, () => q(`select to_status from ride_events where ride_id=$1 order by created_at`, [rideId]));
check("timeline recorded", events.map((e) => e.to_status).join(",") === "requested,accepted,picked_up,dropped_off", events);

// Partner releases a ride back to the pool.
const ride2 = await as(DANA, async () => {
  const [r] = await q(`select rider_id from ride_requests where id=$1`, [rideId]);
  const [x] = await q(`insert into ride_requests (org_id, rider_id, pickup_name, pickup_address, dropoff_name, dropoff_address, pickup_at, needs, payment_type, contact_phone, consent_at, created_by)
    values ($1,$2,'A','a','B','b', now() + interval '2 day', '{}', 'free', '604', now(), $3) returning id`, [BELKIN, r.rider_id, DANA]);
  return x.id;
});
await as(MARCUS, () => q(`select accept_ride($1,'Marcus')`, [ride2]));
check("partner can release a ride", (await as(MARCUS, () => q(`select release_ride($1,'Marcus','Van broke down') as ok`, [ride2])))[0].ok === true);
check("released ride is hidden from the partner who released it", (await as(MARCUS, () => q(`select id from open_rides_for_partner()`))).every((r) => r.id !== ride2));
check("other partners can't release it", (await as(PRIYA, () => q(`select release_ride($1,'Priya','') as ok`, [rideId])))[0].ok === false);
check("released ride is open to other partners", (await as(PRIYA, () => q(`select id from open_rides_for_partner()`))).some((r) => r.id === ride2));
await expectError("partner can't hand a ride directly to another partner", async () => {
  await as(PRIYA, () => q(`select accept_ride($1,'Priya')`, [ride2]));
  await as(PRIYA, () => q(`update ride_requests set partner_org_id=$2 where id=$1`, [ride2, VAN]));
});

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
