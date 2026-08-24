alter table public.production_batch
  drop constraint production_batch_source_channel_check;

alter table public.production_batch
  add constraint production_batch_source_channel_check
  check (source_channel in ('web', 'whatsapp', 'import'));
