-- Rebuild LAUT's empty configuration/domain tables around the approved model.
-- Deliberately preserved: auth.users and public.profiles.

drop table public.production_line_capability_tags;
drop table public.production_line_machines;
drop table public.capability_tags;
drop table public.production_lines;
drop table public.processing_sites;

drop function private.owns_production_line(uuid);
drop function private.owns_processing_site(uuid);

create table public.manufacturing_sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  timezone text not null default 'Asia/Jakarta' check (btrim(timezone) <> ''),
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index manufacturing_sites_owner_id_idx on public.manufacturing_sites(owner_id);

create table public.production_lines (
  id uuid primary key default gen_random_uuid(),
  manufacturing_site_id uuid not null references public.manufacturing_sites(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (manufacturing_site_id, name),
  unique (id, manufacturing_site_id)
);

create index production_lines_manufacturing_site_id_idx
  on public.production_lines(manufacturing_site_id);

create table public.capability_tags (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (btrim(code) <> ''),
  label text not null unique check (btrim(label) <> ''),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.production_line_capability_tags (
  production_line_id uuid not null references public.production_lines(id) on delete cascade,
  capability_tag_id uuid not null references public.capability_tags(id) on delete restrict,
  other_context text,
  created_at timestamptz not null default now(),
  primary key (production_line_id, capability_tag_id),
  check (other_context is null or btrim(other_context) <> '')
);

create index production_line_capability_tags_capability_tag_id_idx
  on public.production_line_capability_tags(capability_tag_id);

create table public.production_batch (
  id uuid primary key default gen_random_uuid(),
  manufacturing_site_id uuid not null references public.manufacturing_sites(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  source_channel text not null default 'web' check (source_channel in ('web', 'whatsapp')),
  batch_reference text,
  production_date date not null default current_date,
  species text,
  product_specification text,
  raw_input_kg numeric(14, 3) check (raw_input_kg is null or raw_input_kg >= 0),
  sellable_output_kg numeric(14, 3) check (sellable_output_kg is null or sellable_output_kg >= 0),
  trimming_kg numeric(14, 3) check (trimming_kg is null or trimming_kg >= 0),
  quality_reject_kg numeric(14, 3) check (quality_reject_kg is null or quality_reject_kg >= 0),
  byproduct_kg numeric(14, 3) check (byproduct_kg is null or byproduct_kg >= 0),
  spoilage_kg numeric(14, 3) check (spoilage_kg is null or spoilage_kg >= 0),
  other_loss_kg numeric(14, 3) check (other_loss_kg is null or other_loss_kg >= 0),
  supplier text,
  shift text,
  fish_size_category text,
  storage_state text,
  receiving_condition text,
  receiving_temperature_c numeric(5, 2),
  delivery_delay_minutes integer check (delivery_delay_minutes is null or delivery_delay_minutes >= 0),
  production_duration_minutes integer check (production_duration_minutes is null or production_duration_minutes >= 0),
  operator_notes text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, manufacturing_site_id),
  check ((status = 'draft' and confirmed_at is null) or (status = 'confirmed' and confirmed_at is not null))
);

create index production_batch_site_status_date_idx
  on public.production_batch(manufacturing_site_id, status, production_date desc);

create table public.production_batch_lines (
  production_batch_id uuid not null,
  production_line_id uuid not null,
  manufacturing_site_id uuid not null,
  sequence integer check (sequence is null or sequence > 0),
  created_at timestamptz not null default now(),
  primary key (production_batch_id, production_line_id),
  foreign key (production_batch_id, manufacturing_site_id)
    references public.production_batch(id, manufacturing_site_id) on delete cascade,
  foreign key (production_line_id, manufacturing_site_id)
    references public.production_lines(id, manufacturing_site_id) on delete restrict
);

create index production_batch_lines_line_site_idx
  on public.production_batch_lines(production_line_id, manufacturing_site_id);

create or replace function private.owns_manufacturing_site(site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.manufacturing_sites
    where id = site_id
      and owner_id = (select auth.uid())
  );
$$;

create or replace function private.owns_production_line(line_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.production_lines as line
    join public.manufacturing_sites as site on site.id = line.manufacturing_site_id
    where line.id = line_id
      and site.owner_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_manufacturing_site(uuid) from public;
revoke all on function private.owns_production_line(uuid) from public;
grant execute on function private.owns_manufacturing_site(uuid) to authenticated;
grant execute on function private.owns_production_line(uuid) to authenticated;

create or replace function private.validate_line_capability_tag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tag_code text;
begin
  select code into tag_code
  from public.capability_tags
  where id = new.capability_tag_id;

  if tag_code = 'other' and (new.other_context is null or btrim(new.other_context) = '') then
    raise exception 'The Other capability tag requires other_context.';
  end if;

  if tag_code <> 'other' and new.other_context is not null then
    raise exception 'other_context is allowed only for the Other capability tag.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_line_capability_tag() from public;

create trigger validate_production_line_capability_tag
  before insert or update on public.production_line_capability_tags
  for each row execute function private.validate_line_capability_tag();

create trigger set_manufacturing_sites_updated_at
  before update on public.manufacturing_sites
  for each row execute function private.set_updated_at();

create trigger set_production_lines_updated_at
  before update on public.production_lines
  for each row execute function private.set_updated_at();

create trigger set_capability_tags_updated_at
  before update on public.capability_tags
  for each row execute function private.set_updated_at();

create trigger set_production_batch_updated_at
  before update on public.production_batch
  for each row execute function private.set_updated_at();

alter table public.manufacturing_sites enable row level security;
alter table public.production_lines enable row level security;
alter table public.capability_tags enable row level security;
alter table public.production_line_capability_tags enable row level security;
alter table public.production_batch enable row level security;
alter table public.production_batch_lines enable row level security;

grant select, insert, update on public.manufacturing_sites to authenticated;
grant select, insert, update on public.production_lines to authenticated;
grant select on public.capability_tags to authenticated;
grant select, insert, update on public.production_line_capability_tags to authenticated;
grant select, insert, update on public.production_batch to authenticated;
grant select, insert, update on public.production_batch_lines to authenticated;

create policy "Owners can read manufacturing sites"
  on public.manufacturing_sites for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "Users can create manufacturing sites"
  on public.manufacturing_sites for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Owners can update manufacturing sites"
  on public.manufacturing_sites for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners can read production lines"
  on public.production_lines for select to authenticated
  using ((select private.owns_manufacturing_site(manufacturing_site_id)));
create policy "Owners can create production lines"
  on public.production_lines for insert to authenticated
  with check ((select private.owns_manufacturing_site(manufacturing_site_id)));
create policy "Owners can update production lines"
  on public.production_lines for update to authenticated
  using ((select private.owns_manufacturing_site(manufacturing_site_id)))
  with check ((select private.owns_manufacturing_site(manufacturing_site_id)));

create policy "Authenticated users can read capability tags"
  on public.capability_tags for select to authenticated using (true);

create policy "Owners can read production line capability tags"
  on public.production_line_capability_tags for select to authenticated
  using ((select private.owns_production_line(production_line_id)));
create policy "Owners can create production line capability tags"
  on public.production_line_capability_tags for insert to authenticated
  with check ((select private.owns_production_line(production_line_id)));
create policy "Owners can update production line capability tags"
  on public.production_line_capability_tags for update to authenticated
  using ((select private.owns_production_line(production_line_id)))
  with check ((select private.owns_production_line(production_line_id)));

create policy "Owners can read production batches"
  on public.production_batch for select to authenticated
  using ((select private.owns_manufacturing_site(manufacturing_site_id)));
create policy "Owners can create production batches"
  on public.production_batch for insert to authenticated
  with check ((select private.owns_manufacturing_site(manufacturing_site_id)));
create policy "Owners can update production batches"
  on public.production_batch for update to authenticated
  using ((select private.owns_manufacturing_site(manufacturing_site_id)))
  with check ((select private.owns_manufacturing_site(manufacturing_site_id)));

create policy "Owners can read production batch lines"
  on public.production_batch_lines for select to authenticated
  using ((select private.owns_manufacturing_site(manufacturing_site_id)));
create policy "Owners can create production batch lines"
  on public.production_batch_lines for insert to authenticated
  with check ((select private.owns_manufacturing_site(manufacturing_site_id)));
create policy "Owners can update production batch lines"
  on public.production_batch_lines for update to authenticated
  using ((select private.owns_manufacturing_site(manufacturing_site_id)))
  with check ((select private.owns_manufacturing_site(manufacturing_site_id)));

insert into public.capability_tags (code, label, description)
values
  ('cutting', 'Cutting', 'Cuts whole fish or portions into process-ready pieces.'),
  ('filleting', 'Filleting', 'Separates fillets from the fish frame.'),
  ('deboning', 'Deboning', 'Removes pin bones or remaining bones from fish portions.'),
  ('skinning', 'Skinning', 'Removes skin from fish portions or fillets.'),
  ('trimming', 'Trimming', 'Trims portions to the required shape, size, or specification.'),
  ('grading', 'Grading', 'Sorts processed product by quality, size, or grade.'),
  ('quality_control', 'Quality Control', 'Performs product checks against the defined specification.'),
  ('weighing', 'Weighing', 'Measures product or packed-product weight.'),
  ('packaging', 'Packaging', 'Packs finished product for storage or distribution.'),
  ('freezing', 'Freezing', 'Freezes product as part of the production flow.'),
  ('glazing', 'Glazing', 'Applies a protective ice glaze to frozen product.'),
  ('cold_storage', 'Cold Storage', 'Holds product under controlled cold storage.'),
  ('rework', 'Rework', 'Reprocesses product that needs correction or recovery.'),
  ('waste_handling', 'Waste Handling', 'Separates or handles non-sellable waste streams.'),
  ('other', 'Other', 'Represents a line capability outside the LAUT preset catalogue.');
