drop policy if exists "Members can read their processing unit" on public.processing_units;
drop policy if exists "Users can create a processing unit" on public.processing_units;
drop policy if exists "Owners can update their processing unit" on public.processing_units;

drop policy if exists "Members can read memberships in their processing unit" on public.processing_unit_memberships;
drop policy if exists "Owners can add memberships" on public.processing_unit_memberships;
drop policy if exists "Owners can update memberships" on public.processing_unit_memberships;
drop policy if exists "Owners can remove memberships" on public.processing_unit_memberships;

drop trigger if exists on_processing_unit_created on public.processing_units;
drop function if exists private.assign_processing_unit_owner();
drop function if exists private.is_processing_unit_member(uuid);
drop function if exists private.is_processing_unit_owner(uuid);

drop table public.processing_unit_memberships;
drop type public.processing_unit_role;

alter table public.processing_units rename to processing_sites;
alter table public.processing_sites rename column created_by to owner_id;
alter index public.processing_units_created_by_idx rename to processing_sites_owner_id_idx;
alter trigger set_processing_units_updated_at on public.processing_sites
  rename to set_processing_sites_updated_at;

create table public.production_units (
  id uuid primary key default gen_random_uuid(),
  processing_site_id uuid not null references public.processing_sites (id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_units_name_not_blank check (length(trim(name)) > 0),
  constraint production_units_site_name_unique unique (processing_site_id, name)
);

create index production_units_processing_site_id_idx
  on public.production_units (processing_site_id);

create trigger set_production_units_updated_at
  before update on public.production_units
  for each row execute procedure private.set_updated_at();

create function private.owns_processing_site(site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.processing_sites site
    where site.id = site_id
      and site.owner_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_processing_site(uuid) from public;
grant execute on function private.owns_processing_site(uuid) to authenticated;

alter table public.production_units enable row level security;

grant select, insert, update on public.production_units to authenticated;

create policy "Owners can read their processing sites"
  on public.processing_sites
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Users can create their processing sites"
  on public.processing_sites
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Owners can update their processing sites"
  on public.processing_sites
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Owners can read production units"
  on public.production_units
  for select
  to authenticated
  using ((select private.owns_processing_site(processing_site_id)));

create policy "Owners can create production units"
  on public.production_units
  for insert
  to authenticated
  with check ((select private.owns_processing_site(processing_site_id)));

create policy "Owners can update production units"
  on public.production_units
  for update
  to authenticated
  using ((select private.owns_processing_site(processing_site_id)))
  with check ((select private.owns_processing_site(processing_site_id)));
