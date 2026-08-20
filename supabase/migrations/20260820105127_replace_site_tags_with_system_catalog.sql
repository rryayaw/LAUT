drop policy "Owners can read production unit process tags" on public.production_unit_process_tags;
drop policy "Owners can create production unit process tags" on public.production_unit_process_tags;
drop policy "Owners can update production unit process tags" on public.production_unit_process_tags;
drop policy "Owners can read process tags" on public.process_tags;
drop policy "Owners can create process tags" on public.process_tags;
drop policy "Owners can update process tags" on public.process_tags;

drop trigger set_process_tags_updated_at on public.process_tags;

alter table public.production_unit_process_tags
  drop constraint production_unit_process_tags_unit_site_fkey,
  drop constraint production_unit_process_tags_tag_site_fkey,
  drop column processing_site_id;

drop index if exists public.process_tags_processing_site_id_idx;
drop index if exists public.production_unit_process_tags_process_tag_id_idx;
drop index if exists public.production_unit_process_tags_unit_site_idx;
drop index if exists public.production_unit_process_tags_tag_site_idx;

alter table public.production_units
  drop constraint production_units_id_site_unique;

alter table public.process_tags
  drop constraint process_tags_site_name_unique,
  drop constraint process_tags_id_site_unique,
  drop column processing_site_id;

alter table public.process_tags
  rename column name to label;

alter table public.process_tags
  add column code text,
  add constraint process_tags_label_not_blank check (length(trim(label)) > 0);

insert into public.process_tags (code, label, description)
values
  ('cutting', 'Cutting', 'Primary cutting or sizing of fish or fillet portions.'),
  ('filleting', 'Filleting', 'Separating fillets from whole fish.'),
  ('deboning', 'Deboning', 'Removing bones from fish or fillets.'),
  ('skinning', 'Skinning', 'Removing skin from fish or fillets.'),
  ('trimming', 'Trimming', 'Removing non-sellable or specification-excess material.'),
  ('grading', 'Grading', 'Sorting finished material by grade or specification.'),
  ('quality_control', 'Quality control', 'Inspecting product against the configured quality standard.'),
  ('weighing', 'Weighing', 'Measuring product or loss-category weights during processing.'),
  ('packaging', 'Packaging', 'Packing sellable product for storage or shipment.'),
  ('freezing', 'Freezing', 'Freezing product as part of the production process.'),
  ('glazing', 'Glazing', 'Applying a protective ice glaze to frozen product.'),
  ('cold_storage', 'Cold storage', 'Holding product under controlled cold storage.'),
  ('rework', 'Rework', 'Reprocessing product that requires corrective handling.'),
  ('waste_handling', 'Waste handling', 'Handling production waste or non-sellable material.'),
  ('other', 'Other', 'A user-described process not represented by the preset catalogue.');

alter table public.process_tags
  alter column code set not null,
  add constraint process_tags_code_unique unique (code),
  add constraint process_tags_label_unique unique (label);

alter table public.production_unit_process_tags
  add column other_context text,
  add constraint production_unit_process_tags_other_context_not_blank
    check (other_context is null or length(trim(other_context)) > 0),
  add constraint production_unit_process_tags_unit_fkey
    foreign key (production_unit_id)
    references public.production_units (id)
    on delete cascade,
  add constraint production_unit_process_tags_tag_fkey
    foreign key (process_tag_id)
    references public.process_tags (id)
    on delete restrict;

create index production_unit_process_tags_process_tag_id_idx
  on public.production_unit_process_tags (process_tag_id);

create function private.owns_production_unit(unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.production_units unit
    join public.processing_sites site on site.id = unit.processing_site_id
    where unit.id = unit_id
      and site.owner_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_production_unit(uuid) from public;
grant execute on function private.owns_production_unit(uuid) to authenticated;

revoke all on table public.process_tags from authenticated;
grant select on public.process_tags to authenticated;
grant select, insert, update on public.production_unit_process_tags to authenticated;

create policy "Authenticated users can read system process tags"
  on public.process_tags
  for select
  to authenticated
  using (true);

create policy "Owners can read production unit process tags"
  on public.production_unit_process_tags
  for select
  to authenticated
  using ((select private.owns_production_unit(production_unit_id)));

create policy "Owners can create production unit process tags"
  on public.production_unit_process_tags
  for insert
  to authenticated
  with check ((select private.owns_production_unit(production_unit_id)));

create policy "Owners can update production unit process tags"
  on public.production_unit_process_tags
  for update
  to authenticated
  using ((select private.owns_production_unit(production_unit_id)))
  with check ((select private.owns_production_unit(production_unit_id)));
