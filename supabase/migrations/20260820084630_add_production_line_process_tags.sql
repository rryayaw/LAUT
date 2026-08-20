create table public.process_tags (
  id uuid primary key default gen_random_uuid(),
  processing_site_id uuid not null references public.processing_sites (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint process_tags_name_not_blank check (length(trim(name)) > 0),
  constraint process_tags_site_name_unique unique (processing_site_id, name),
  constraint process_tags_id_site_unique unique (id, processing_site_id)
);

alter table public.production_units
  add constraint production_units_id_site_unique unique (id, processing_site_id);

create table public.production_unit_process_tags (
  production_unit_id uuid not null,
  process_tag_id uuid not null,
  processing_site_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (production_unit_id, process_tag_id),
  constraint production_unit_process_tags_unit_site_fkey
    foreign key (production_unit_id, processing_site_id)
    references public.production_units (id, processing_site_id)
    on delete cascade,
  constraint production_unit_process_tags_tag_site_fkey
    foreign key (process_tag_id, processing_site_id)
    references public.process_tags (id, processing_site_id)
    on delete cascade
);

create index process_tags_processing_site_id_idx
  on public.process_tags (processing_site_id);

create index production_unit_process_tags_process_tag_id_idx
  on public.production_unit_process_tags (process_tag_id);

create trigger set_process_tags_updated_at
  before update on public.process_tags
  for each row execute procedure private.set_updated_at();

alter table public.process_tags enable row level security;
alter table public.production_unit_process_tags enable row level security;

grant select, insert, update on public.process_tags to authenticated;
grant select, insert, update on public.production_unit_process_tags to authenticated;

create policy "Owners can read process tags"
  on public.process_tags
  for select
  to authenticated
  using ((select private.owns_processing_site(processing_site_id)));

create policy "Owners can create process tags"
  on public.process_tags
  for insert
  to authenticated
  with check ((select private.owns_processing_site(processing_site_id)));

create policy "Owners can update process tags"
  on public.process_tags
  for update
  to authenticated
  using ((select private.owns_processing_site(processing_site_id)))
  with check ((select private.owns_processing_site(processing_site_id)));

create policy "Owners can read production unit process tags"
  on public.production_unit_process_tags
  for select
  to authenticated
  using ((select private.owns_processing_site(processing_site_id)));

create policy "Owners can create production unit process tags"
  on public.production_unit_process_tags
  for insert
  to authenticated
  with check ((select private.owns_processing_site(processing_site_id)));

create policy "Owners can update production unit process tags"
  on public.production_unit_process_tags
  for update
  to authenticated
  using ((select private.owns_processing_site(processing_site_id)))
  with check ((select private.owns_processing_site(processing_site_id)));
