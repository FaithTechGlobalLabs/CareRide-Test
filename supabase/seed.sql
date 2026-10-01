-- Starter data for a new CareRide project. Organizations below are fictional
-- placeholders; replace them with the real pilot partners.

insert into organizations (id, name, type, service_area, capabilities, offers_free, offers_paid, contact_email, contact_phone) values
  ('00000000-0000-0000-0000-00000000b001', 'Belkin House', 'salvation_army', 'Downtown Vancouver', '{}', false, false, 'frontdesk@belkin.example', '604-555-0100'),
  ('00000000-0000-0000-0000-00000000a001', 'Hope Rides Volunteer Drivers', 'partner', 'Vancouver & Burnaby', '{escort}', true, false, 'dispatch@hoperides.example', '604-555-0141'),
  ('00000000-0000-0000-0000-00000000a002', 'Grace Church Care Van', 'partner', 'Downtown Vancouver', '{wheelchair,escort}', true, false, 'carevan@gracechurch.example', '604-555-0162'),
  ('00000000-0000-0000-0000-00000000a003', 'Metro Accessible Cabs', 'partner', 'Metro Vancouver', '{wheelchair}', false, true, 'accounts@metrocabs.example', '604-555-0188');

insert into places (org_id, name, address, type) values
  ('00000000-0000-0000-0000-00000000b001', 'Belkin House front desk', '555 Homer St, Vancouver', 'office'),
  ('00000000-0000-0000-0000-00000000b001', 'Vancouver General Hospital', '920 W 10th Ave, Vancouver', 'hospital'),
  ('00000000-0000-0000-0000-00000000b001', 'St. Paul''s Hospital', '1081 Burrard St, Vancouver', 'hospital'),
  ('00000000-0000-0000-0000-00000000b001', 'Downtown Community Court', '211 Gore Ave, Vancouver', 'court'),
  ('00000000-0000-0000-0000-00000000b001', 'Union Gospel Mission (shelter intake)', '601 E Hastings St, Vancouver', 'shelter');

insert into funding_sources (org_id, name, monthly_budget_cents) values
  ('00000000-0000-0000-0000-00000000b001', 'Belkin transportation fund', 150000),
  ('00000000-0000-0000-0000-00000000b001', 'Health outreach grant', 80000);

-- People sign in by magic link. Invite them in Supabase (Authentication → Users → Invite),
-- then link each auth user to an organization and role, for example:
--
-- insert into profiles (id, org_id, name, email, role)
-- select id, '00000000-0000-0000-0000-00000000b001', 'Dana', email, 'staff'
-- from auth.users where email = 'dana@example.org';
--
-- insert into profiles (id, org_id, name, email, role)
-- select id, '00000000-0000-0000-0000-00000000a002', 'Marcus', email, 'partner'
-- from auth.users where email = 'marcus@example.org';
