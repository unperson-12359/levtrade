create table if not exists tracked_signals (
  id text primary key,
  scope text not null default 'global',
  coin text not null,
  kind text not null,
  direction text not null,
  signal_json jsonb not null,
  outcomes_json jsonb not null,
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tracked_signals_recorded
  on tracked_signals (recorded_at desc);
create index if not exists idx_tracked_signals_scope_coin_kind
  on tracked_signals (scope, coin, kind, recorded_at desc);
