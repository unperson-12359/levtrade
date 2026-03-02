create table if not exists server_setups (
  id text primary key,
  coin text not null,
  direction text not null,
  setup_json jsonb not null,
  generated_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_server_setups_generated
  on server_setups (generated_at desc);

create index if not exists idx_server_setups_coin_dir
  on server_setups (coin, direction, generated_at desc);
