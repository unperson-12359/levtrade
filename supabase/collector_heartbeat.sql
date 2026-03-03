create table if not exists collector_heartbeat (
  collector_name text primary key,
  last_run_at timestamptz not null,
  last_success_at timestamptz null,
  last_error text null,
  updated_at timestamptz not null default now()
);
