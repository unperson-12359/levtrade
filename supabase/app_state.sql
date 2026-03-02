create table if not exists app_state (
  scope text primary key,
  state_json jsonb not null,
  schema_version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into app_state (scope, state_json, schema_version)
values ('global', '{}'::jsonb, 1)
on conflict (scope) do nothing;
