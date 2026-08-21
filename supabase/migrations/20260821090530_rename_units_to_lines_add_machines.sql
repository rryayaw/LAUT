drop policy "Owners can read production units" on public.production_units;
drop policy "Owners can create production units" on public.production_units;
drop policy "Owners can update production units" on public.production_units;
drop policy "Owners can read production unit process tags" on public.production_unit_process_tags;
drop policy "Owners can create production unit process tags" on public.production_unit_process_tags;
drop policy "Owners can update production unit process tags" on public.production_unit_process_tags;

drop function private.owns_production_unit(uuid);

alter table public.production_units rename to production_lines;
alter table public.production_unit_process_tags rename to production_line_process_tags;
alter table public.production_line_process_tags rename column production_unit_id to production_line_id;

alter table public.production_lines rename constraint production_units_pkey to production_lines_pkey;
alter table public.production_lines rename constraint production_units_processing_site_id_fkey to production_lines_processing_site_id_fkey;
alter table public.production_lines rename constraint production_units_site_name_unique to production_lines_site_name_unique;
alter table public.production_lines rename constraint production_units_name_not_blank to production_lines_name_not_blank;
alter index public.production_units_processing_site_id_idx rename to production_lines_processing_site_id_idx;
alter trigger set_production_units_updated_at on public.production_lines rename to set_production_lines_updated_at;

alter table public.production_line_process_tags rename constraint production_unit_process_tags_pkey to production_line_process_tags_pkey;
alter table public.production_line_process_tags rename constraint production_unit_process_tags_unit_fkey to production_line_process_tags_line_fkey;
alter table public.production_line_process_tags rename constraint production_unit_process_tags_tag_fkey to production_line_process_tags_tag_fkey;
alter table public.production_line_process_tags rename constraint production_unit_process_tags_other_context_not_blank to production_line_process_tags_other_context_not_blank;
alter index public.production_unit_process_tags_process_tag_id_idx rename to production_line_process_tags_process_tag_id_idx;

create function private.owns_production_line(line_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.production_lines line
    join public.processing_sites site on site.id = line.processing_site_id
    where line.id = line_id
      and site.owner_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_production_line(uuid) from public;
grant execute on function private.owns_production_line(uuid) to authenticated;

create policy "Owners can read production lines"
  on public.production_lines
  for select
  to authenticated
  using ((select private.owns_processing_site(processing_site_id)));

create policy "Owners can create production lines"
  on public.production_lines
  for insert
  to authenticated
  with check ((select private.owns_processing_site(processing_site_id)));

create policy "Owners can update production lines"
  on public.production_lines
  for update
  to authenticated
  using ((select private.owns_processing_site(processing_site_id)))
  with check ((select private.owns_processing_site(processing_site_id)));

create policy "Owners can read production line process tags"
  on public.production_line_process_tags
  for select
  to authenticated
  using ((select private.owns_production_line(production_line_id)));

create policy "Owners can create production line process tags"
  on public.production_line_process_tags
  for insert
  to authenticated
  with check ((select private.owns_production_line(production_line_id)));

create policy "Owners can update production line process tags"
  on public.production_line_process_tags
  for update
  to authenticated
  using ((select private.owns_production_line(production_line_id)))
  with check ((select private.owns_production_line(production_line_id)));

create table public.production_line_machines (
  id uuid primary key default gen_random_uuid(),
  production_line_id uuid not null references public.production_lines (id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_line_machines_name_not_blank check (length(trim(name)) > 0),
  constraint production_line_machines_line_name_unique unique (production_line_id, name)
);

create index production_line_machines_production_line_id_idx
  on public.production_line_machines (production_line_id);

create trigger set_production_line_machines_updated_at
  before update on public.production_line_machines
  for each row execute procedure private.set_updated_at();

alter table public.production_line_machines enable row level security;
grant select, insert, update on public.production_line_machines to authenticated;

create policy "Owners can read production line machines"
  on public.production_line_machines
  for select
  to authenticated
  using ((select private.owns_production_line(production_line_id)));

create policy "Owners can create production line machines"
  on public.production_line_machines
  for insert
  to authenticated
  with check ((select private.owns_production_line(production_line_id)));

create policy "Owners can update production line machines"
  on public.production_line_machines
  for update
  to authenticated
  using ((select private.owns_production_line(production_line_id)))
  with check ((select private.owns_production_line(production_line_id)));
