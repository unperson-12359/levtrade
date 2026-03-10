create table if not exists observatory_indicator_states (
  id text primary key,
  coin text not null,
  interval text not null,
  candle_time timestamptz not null,
  indicator_id text not null,
  category text not null,
  is_on boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_observatory_indicator_states_market_bar
  on observatory_indicator_states (coin, interval, candle_time desc);

create index if not exists idx_observatory_indicator_states_indicator_bar
  on observatory_indicator_states (indicator_id, candle_time desc);
