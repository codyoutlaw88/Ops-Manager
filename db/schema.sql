-- Ops Manager schema. Safe to run more than once.

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists secrets (
  name text primary key,
  ciphertext text not null,          -- AES-256-GCM, never returned to the browser
  updated_at timestamptz not null default now()
);

create table if not exists runs (
  id bigserial primary key,
  slot text not null,                 -- '6am' | '11am' | '3pm' | 'manual'
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  window_start timestamptz,
  window_end timestamptz,
  status text not null default 'running',  -- running | ok | failed
  error text,
  read_count int not null default 0,
  skipped_count int not null default 0,
  extracted_count int not null default 0
);

create table if not exists mail_seen (
  id bigserial primary key,
  run_id bigint references runs(id) on delete set null,
  uid bigint not null,
  uid_validity bigint not null,
  message_id text,
  from_addr text,
  subject text,
  received_at timestamptz,
  category text,
  skip_reason text,
  summary text,
  unique (uid_validity, uid)
);

create table if not exists rundowns (
  id bigserial primary key,
  run_id bigint references runs(id) on delete cascade,
  created_at timestamptz not null default now(),
  needs_today jsonb not null default '[]',
  coming_up jsonb not null default '[]',
  fyi jsonb not null default '[]',
  failed boolean not null default false,
  text text not null,
  push_sent boolean not null default false
);

create table if not exists open_items (
  id bigserial primary key,
  kind text not null,                 -- bill | shutoff | locked_card | settlement | package | trip | birthday | appointment | other
  title text not null,
  detail text,
  amount numeric(12,2),
  due_date date,
  status text not null default 'open',   -- open | done
  source_mail_id bigint references mail_seen(id) on delete set null,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

create table if not exists bills (
  id bigserial primary key,
  biller text not null,
  amount numeric(12,2),
  due_date date,
  autopay boolean,
  status text not null default 'unconfirmed',  -- paid | due | past_due | unconfirmed
  email_says text,                    -- what the email claimed (paid, due, past due, failed)
  verified_at timestamptz,
  source_mail_id bigint references mail_seen(id) on delete set null,
  dedupe_key text unique,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists card_declines (
  id bigserial primary key,
  merchant text,
  amount numeric(12,2),
  occurred_at timestamptz,
  card_last4 text,
  notes text,
  source_mail_id bigint references mail_seen(id) on delete set null,
  dedupe_key text unique,
  created_at timestamptz not null default now()
);

create table if not exists kids (
  id serial primary key,
  name text not null unique,
  grade text,
  school text,
  birthday date
);

create table if not exists kid_notes (
  id bigserial primary key,
  kid_id int references kids(id) on delete cascade,
  kind text not null default 'note',  -- grade | missing_work | note
  class_name text,
  text text not null,
  noted_on date not null default current_date,
  source_mail_id bigint references mail_seen(id) on delete set null
);

create table if not exists lunch_transactions (
  id bigserial primary key,
  kid_id int references kids(id) on delete cascade,
  occurred_on date not null default current_date,
  description text,
  amount numeric(12,2),
  balance_after numeric(12,2),
  source_mail_id bigint references mail_seen(id) on delete set null
);

create table if not exists school_events (
  id bigserial primary key,
  kid_id int references kids(id) on delete cascade,   -- null = all kids
  title text not null,
  starts_at timestamptz,
  event_date date,
  location text,
  source_mail_id bigint references mail_seen(id) on delete set null,
  dedupe_key text unique
);

create table if not exists recruiters (
  id bigserial primary key,
  name text,
  company text,
  role text,
  pay text,
  location text,
  status text not null default 'new',  -- new | talking | applied | interviewing | offer | passed | closed
  next_step text,
  next_step_date date,
  last_contact timestamptz,
  notes text,
  source_mail_id bigint references mail_seen(id) on delete set null,
  dedupe_key text unique
);

create table if not exists trips_events (
  id bigserial primary key,
  kind text not null default 'event',  -- trip | birthday | event
  title text not null,
  start_date date,
  end_date date,
  people text,
  notes text,
  dedupe_key text unique
);

create table if not exists filters (
  id serial primary key,
  kind text not null,                 -- sender_domain | sender_contains | subject_contains
  pattern text not null,
  reason text not null default 'bid_invite',
  unique (kind, pattern)
);

create table if not exists push_subscriptions (
  endpoint text primary key,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

-- Seed data
insert into kids (name, grade, school, birthday) values
  ('Ryan', '9th', 'Jim Ned High School', null),
  ('Karsyn', '8th', 'Jim Ned Middle School', null),
  ('Korie', null, null, '2016-11-28')
on conflict (name) do nothing;

insert into filters (kind, pattern, reason) values
  ('sender_domain', 'planhub.com', 'bid_invite'),
  ('sender_domain', 'buildingconnected.com', 'bid_invite'),
  ('sender_domain', 'autodesk.com', 'bid_invite'),
  ('sender_domain', 'isqft.com', 'bid_invite'),
  ('sender_domain', 'constructconnect.com', 'bid_invite'),
  ('sender_domain', 'smartbidnet.com', 'bid_invite'),
  ('sender_domain', 'procore.com', 'bid_invite'),
  ('sender_contains', 'summit gc', 'bid_invite'),
  ('sender_contains', 'summitgc', 'bid_invite'),
  ('subject_contains', 'invitation to bid', 'bid_invite'),
  ('subject_contains', 'bid invitation', 'bid_invite'),
  ('subject_contains', 'itb:', 'bid_invite')
on conflict (kind, pattern) do nothing;

insert into trips_events (kind, title, start_date, people, notes, dedupe_key) values
  ('birthday', 'Korie turns 10', '2026-11-28', 'Korie', null, 'birthday:korie:2026')
on conflict (dedupe_key) do nothing;
