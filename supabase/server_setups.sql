create table if not exists server_setups (
  id text primary key,
  scope text not null default 'legacy',
  coin text not null,
  direction text not null,
  setup_json jsonb not null,
  generated_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table server_setups
  add column if not exists scope text;

update server_setups
set scope = 'legacy'
where scope is null;

alter table server_setups
  alter column scope set default 'legacy';

alter table server_setups
  alter column scope set not null;

create index if not exists idx_server_setups_generated
  on server_setups (generated_at desc);

create index if not exists idx_server_setups_coin_dir
  on server_setups (coin, direction, generated_at desc);

create index if not exists idx_server_setups_scope_generated
  on server_setups (scope, generated_at desc);

create index if not exists idx_server_setups_scope_coin_dir
  on server_setups (scope, coin, direction, generated_at desc);
