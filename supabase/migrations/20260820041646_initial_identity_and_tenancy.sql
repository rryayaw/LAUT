create schema if not exists private;

revoke all on schema private from public;

create type public.processing_unit_role as enum (
  'owner',
  'manager',
  'supervisor',
  'quality_control'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_not_blank
    check (display_name is null or length(trim(display_name)) > 0)
);

create table public.processing_units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Jakarta',
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint processing_units_name_not_blank check (length(trim(name)) > 0),
  constraint processing_units_timezone_not_blank check (length(trim(timezone)) > 0)
);

create table public.processing_unit_memberships (
  processing_unit_id uuid not null references public.processing_units (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.processing_unit_role not null,
  created_at timestamptz not null default now(),
  primary key (processing_unit_id, user_id)
);

create index processing_unit_memberships_user_id_idx
  on public.processing_unit_memberships (user_id);

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

create function private.assign_processing_unit_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.processing_unit_memberships (processing_unit_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_processing_unit_created
  after insert on public.processing_units
  for each row execute procedure private.assign_processing_unit_owner();

create function private.is_processing_unit_member(unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.processing_unit_memberships membership
    where membership.processing_unit_id = unit_id
      and membership.user_id = (select auth.uid())
  );
$$;

create function private.is_processing_unit_owner(unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.processing_unit_memberships membership
    where membership.processing_unit_id = unit_id
      and membership.user_id = (select auth.uid())
      and membership.role = 'owner'
  );
$$;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure private.set_updated_at();

create trigger set_processing_units_updated_at
  before update on public.processing_units
  for each row execute procedure private.set_updated_at();

alter table public.profiles enable row level security;
alter table public.processing_units enable row level security;
alter table public.processing_unit_memberships enable row level security;

grant usage on schema private to authenticated;
grant execute on function private.is_processing_unit_member(uuid) to authenticated;
grant execute on function private.is_processing_unit_owner(uuid) to authenticated;

revoke all on function private.handle_new_user() from public;
revoke all on function private.assign_processing_unit_owner() from public;
revoke all on function private.set_updated_at() from public;

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.processing_units to authenticated;
grant select, insert, update, delete on public.processing_unit_memberships to authenticated;

create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Members can read their processing unit"
  on public.processing_units
  for select
  to authenticated
  using ((select private.is_processing_unit_member(id)));

create policy "Users can create a processing unit"
  on public.processing_units
  for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

create policy "Owners can update their processing unit"
  on public.processing_units
  for update
  to authenticated
  using ((select private.is_processing_unit_owner(id)))
  with check ((select private.is_processing_unit_owner(id)));

create policy "Members can read memberships in their processing unit"
  on public.processing_unit_memberships
  for select
  to authenticated
  using ((select private.is_processing_unit_member(processing_unit_id)));

create policy "Owners can add memberships"
  on public.processing_unit_memberships
  for insert
  to authenticated
  with check ((select private.is_processing_unit_owner(processing_unit_id)));

create policy "Owners can update memberships"
  on public.processing_unit_memberships
  for update
  to authenticated
  using ((select private.is_processing_unit_owner(processing_unit_id)))
  with check ((select private.is_processing_unit_owner(processing_unit_id)));

create policy "Owners can remove memberships"
  on public.processing_unit_memberships
  for delete
  to authenticated
  using ((select private.is_processing_unit_owner(processing_unit_id)));
