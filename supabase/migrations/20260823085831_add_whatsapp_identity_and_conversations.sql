create table public.whatsapp_identities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null check (btrim(provider) <> ''),
  channel text not null check (btrim(channel) <> ''),
  external_identity text not null check (external_identity ~ '^[0-9]{7,15}$'),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, channel, external_identity),
  unique (profile_id, provider, channel)
);

create index whatsapp_identities_profile_id_idx on public.whatsapp_identities(profile_id);

create table public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  whatsapp_identity_id uuid not null references public.whatsapp_identities(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'closed', 'expired')),
  intent text,
  current_step text not null default 'awaiting_intent' check (btrim(current_step) <> ''),
  language text,
  draft jsonb not null default '{}'::jsonb check (jsonb_typeof(draft) = 'object'),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index whatsapp_conversations_one_active_identity_idx
  on public.whatsapp_conversations(whatsapp_identity_id) where status = 'active';
create index whatsapp_conversations_identity_last_message_idx
  on public.whatsapp_conversations(whatsapp_identity_id, last_message_at desc);

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  whatsapp_identity_id uuid references public.whatsapp_identities(id) on delete restrict,
  whatsapp_conversation_id uuid references public.whatsapp_conversations(id) on delete restrict,
  provider text not null check (btrim(provider) <> ''),
  channel text not null check (btrim(channel) <> ''),
  external_message_id text not null check (btrim(external_message_id) <> ''),
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null default 'text' check (btrim(message_type) <> ''),
  text_content text check (text_content is null or char_length(text_content) <= 4000),
  delivery_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, channel, external_message_id)
);

create index whatsapp_messages_identity_created_at_idx on public.whatsapp_messages(whatsapp_identity_id, created_at desc);
create index whatsapp_messages_conversation_created_at_idx on public.whatsapp_messages(whatsapp_conversation_id, created_at desc);

create trigger set_whatsapp_identities_updated_at before update on public.whatsapp_identities
  for each row execute function private.set_updated_at();
create trigger set_whatsapp_conversations_updated_at before update on public.whatsapp_conversations
  for each row execute function private.set_updated_at();
create trigger set_whatsapp_messages_updated_at before update on public.whatsapp_messages
  for each row execute function private.set_updated_at();

alter table public.whatsapp_identities enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;