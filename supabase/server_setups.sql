create table if not exists server_setups (
  id text primary key,
  scope text not null default 'global',
  coin text not null,
  direction text not null,
  setup_json jsonb not null,
  outcomes_json jsonb,
  generated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table server_setups
  add column if not exists scope text;

alter table server_setups
  add column if not exists outcomes_json jsonb;

alter table server_setups
  add column if not exists updated_at timestamptz;

update server_setups
set scope = 'global'
where scope is null;

update server_setups
set outcomes_json = jsonb_build_object(
  '4h', jsonb_build_object('window', '4h', 'result', 'pending', 'resolutionReason', 'pending', 'coverageStatus', 'full', 'candleCountUsed', 0),
  '24h', jsonb_build_object('window', '24h', 'result', 'pending', 'resolutionReason', 'pending', 'coverageStatus', 'full', 'candleCountUsed', 0),
  '72h', jsonb_build_object('window', '72h', 'result', 'pending', 'resolutionReason', 'pending', 'coverageStatus', 'full', 'candleCountUsed', 0)
)
where outcomes_json is null;

update server_setups
set updated_at = coalesce(updated_at, generated_at, created_at, now())
where updated_at is null;

alter table server_setups
  alter column scope set default 'global';

alter table server_setups
  alter column scope set not null;

alter table server_setups
  alter column updated_at set default now();

alter table server_setups
  alter column updated_at set not null;

create index if not exists idx_server_setups_generated
  on server_setups (generated_at desc);

create index if not exists idx_server_setups_coin_dir
  on server_setups (coin, direction, generated_at desc);

create index if not exists idx_server_setups_scope_generated
  on server_setups (scope, generated_at desc);

create index if not exists idx_server_setups_scope_coin_dir
  on server_setups (scope, coin, direction, generated_at desc);
