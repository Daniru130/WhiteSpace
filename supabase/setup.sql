-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run

create table spaces (
  code text primary key,
  created_at timestamptz default now()
);

create table items (
  id uuid primary key,
  space_code text not null references spaces(code) on delete cascade,
  file_path text not null,
  file_url text not null,
  file_name text not null,
  file_type text not null,
  x double precision not null default 0,
  y double precision not null default 0,
  created_at timestamptz default now()
);
create index on items (space_code);

alter table spaces enable row level security;
alter table items enable row level security;

-- v1: the space code works like a password. Tighten with real auth later.
create policy "v1 open spaces" on spaces for all using (true) with check (true);
create policy "v1 open items" on items for all using (true) with check (true);

alter publication supabase_realtime add table items;

insert into storage.buckets (id, name, public) values ('files', 'files', true)
  on conflict (id) do nothing;

create policy "v1 files read" on storage.objects for select using (bucket_id = 'files');
create policy "v1 files upload" on storage.objects for insert with check (bucket_id = 'files');
create policy "v1 files delete" on storage.objects for delete using (bucket_id = 'files');
