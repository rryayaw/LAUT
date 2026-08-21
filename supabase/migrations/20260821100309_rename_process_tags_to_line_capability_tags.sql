drop policy "Authenticated users can read system process tags" on public.process_tags;
drop policy "Owners can read production line process tags" on public.production_line_process_tags;
drop policy "Owners can create production line process tags" on public.production_line_process_tags;
drop policy "Owners can update production line process tags" on public.production_line_process_tags;

alter table public.process_tags rename to capability_tags;
alter table public.production_line_process_tags rename to production_line_capability_tags;
alter table public.production_line_capability_tags rename column process_tag_id to capability_tag_id;

alter table public.capability_tags rename constraint process_tags_pkey to capability_tags_pkey;
alter table public.capability_tags rename constraint process_tags_code_unique to capability_tags_code_unique;
alter table public.capability_tags rename constraint process_tags_label_unique to capability_tags_label_unique;
alter table public.capability_tags rename constraint process_tags_label_not_blank to capability_tags_label_not_blank;
alter table public.production_line_capability_tags rename constraint production_line_process_tags_pkey to production_line_capability_tags_pkey;
alter table public.production_line_capability_tags rename constraint production_line_process_tags_line_fkey to production_line_capability_tags_line_fkey;
alter table public.production_line_capability_tags rename constraint production_line_process_tags_tag_fkey to production_line_capability_tags_capability_tag_fkey;
alter table public.production_line_capability_tags rename constraint production_line_process_tags_other_context_not_blank to production_line_capability_tags_other_context_not_blank;
alter index public.production_line_process_tags_process_tag_id_idx rename to production_line_capability_tags_capability_tag_id_idx;

create policy "Authenticated users can read capability tags"
  on public.capability_tags
  for select
  to authenticated
  using (true);

create policy "Owners can read production line capability tags"
  on public.production_line_capability_tags
  for select
  to authenticated
  using ((select private.owns_production_line(production_line_id)));

create policy "Owners can create production line capability tags"
  on public.production_line_capability_tags
  for insert
  to authenticated
  with check ((select private.owns_production_line(production_line_id)));

create policy "Owners can update production line capability tags"
  on public.production_line_capability_tags
  for update
  to authenticated
  using ((select private.owns_production_line(production_line_id)))
  with check ((select private.owns_production_line(production_line_id)));
