create table public.production_batch_audit_events (
  id uuid primary key default gen_random_uuid(),
  production_batch_id uuid not null references public.production_batch(id) on delete restrict,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null check (btrim(event_type) <> ''),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index production_batch_audit_events_batch_created_at_idx
  on public.production_batch_audit_events(production_batch_id, created_at desc);

alter table public.production_batch_audit_events enable row level security;

grant select on public.production_batch_audit_events to authenticated;

create policy "Owners can read production batch audit events"
  on public.production_batch_audit_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.production_batch as batch
      where batch.id = production_batch_id
        and (select private.owns_manufacturing_site(batch.manufacturing_site_id))
    )
  );
