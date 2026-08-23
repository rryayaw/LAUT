create table public.production_batch_analyses (
  id uuid primary key default gen_random_uuid(),
  production_batch_id uuid not null unique references public.production_batch(id) on delete restrict,
  assessment jsonb not null check (jsonb_typeof(assessment) = 'object'),
  guidance jsonb check (guidance is null or jsonb_typeof(guidance) = 'object'),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'object'),
  ai_status text not null check (btrim(ai_status) <> ''),
  created_at timestamptz not null default now()
);

create index production_batch_analyses_batch_created_at_idx
  on public.production_batch_analyses(production_batch_id, created_at desc);

alter table public.production_batch_analyses enable row level security;

revoke all on public.production_batch_analyses from anon, authenticated;
grant select on public.production_batch_analyses to authenticated;

create policy "Owners can read production batch analyses"
  on public.production_batch_analyses
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
