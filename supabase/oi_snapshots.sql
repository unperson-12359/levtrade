create table if not exists oi_snapshots (
  id bigint generated always as identity primary key,
  coin text not null,
  oi numeric not null,
  captured_at timestamptz not null default now()
);

create index if not exists idx_oi_snapshots_coin_time
  on oi_snapshots (coin, captured_at desc);
