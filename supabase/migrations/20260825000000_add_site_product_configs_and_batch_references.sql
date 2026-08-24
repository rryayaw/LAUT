-- A site declares the fish products it processes. This is the catalogue used by
-- batch entry; it is intentionally independent of whether a batch is confirmed.
create table public.site_product_configs (
  id uuid primary key default gen_random_uuid(),
  manufacturing_site_id uuid not null references public.manufacturing_sites(id) on delete cascade,
  species text not null check (btrim(species) <> ''),
  product_specification text not null check (btrim(product_specification) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index site_product_configs_site_species_specification_key
  on public.site_product_configs (manufacturing_site_id, lower(species), lower(product_specification));
create index site_product_configs_manufacturing_site_id_idx
  on public.site_product_configs(manufacturing_site_id);

-- Keep current operations available in the new catalogue from the moment this
-- migration is applied, including imported historical data.
insert into public.site_product_configs (manufacturing_site_id, species, product_specification)
select distinct manufacturing_site_id, btrim(species), btrim(product_specification)
from public.production_batch
where nullif(btrim(species), '') is not null
  and nullif(btrim(product_specification), '') is not null
on conflict do nothing;

create trigger set_site_product_configs_updated_at
  before update on public.site_product_configs
  for each row execute function private.set_updated_at();

alter table public.site_product_configs enable row level security;
grant select, insert, update, delete on public.site_product_configs to authenticated;

create policy "Owners can read site product configs"
  on public.site_product_configs for select to authenticated
  using (private.owns_manufacturing_site(manufacturing_site_id));
create policy "Owners can add site product configs"
  on public.site_product_configs for insert to authenticated
  with check (private.owns_manufacturing_site(manufacturing_site_id));
create policy "Owners can update site product configs"
  on public.site_product_configs for update to authenticated
  using (private.owns_manufacturing_site(manufacturing_site_id))
  with check (private.owns_manufacturing_site(manufacturing_site_id));
create policy "Owners can delete site product configs"
  on public.site_product_configs for delete to authenticated
  using (private.owns_manufacturing_site(manufacturing_site_id));

-- References are generated centrally, so a primary-key UUID is never presented
-- to operators as a batch name. A single sequence also keeps them unique across
-- all sites and channels.
create sequence public.production_batch_reference_seq;

create or replace function private.assign_production_batch_reference()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.batch_reference is null or btrim(new.batch_reference) = '' then
    new.batch_reference := 'B-' || to_char(coalesce(new.production_date, current_date), 'YYYYMMDD')
      || '-' || lpad(nextval('public.production_batch_reference_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create trigger assign_production_batch_reference
  before insert on public.production_batch
  for each row execute function private.assign_production_batch_reference();

update public.production_batch
set batch_reference = 'B-' || to_char(coalesce(production_date, current_date), 'YYYYMMDD')
  || '-' || lpad(nextval('public.production_batch_reference_seq')::text, 5, '0')
where batch_reference is null or btrim(batch_reference) = '';

alter table public.production_batch
  alter column batch_reference set not null;
create unique index production_batch_reference_key
  on public.production_batch(batch_reference);
