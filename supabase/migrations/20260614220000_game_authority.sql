create table if not exists public.game_rooms (
  room_code text primary key check (room_code ~ '^[A-Z0-9]{6}$'),
  host_token uuid not null,
  guest_token uuid,
  host_name text not null,
  guest_name text,
  game_state jsonb not null,
  series_state jsonb not null,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dictionary_reports (
  id bigint generated always as identity primary key,
  word text not null,
  reason text not null,
  room_code text,
  reported_at timestamptz not null default now()
);

alter table public.game_rooms enable row level security;
alter table public.dictionary_reports enable row level security;

do $$
begin
  alter publication supabase_realtime add table public.game_rooms;
exception
  when duplicate_object then null;
end $$;
