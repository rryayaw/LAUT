create index production_unit_process_tags_unit_site_idx
  on public.production_unit_process_tags (production_unit_id, processing_site_id);

create index production_unit_process_tags_tag_site_idx
  on public.production_unit_process_tags (process_tag_id, processing_site_id);
