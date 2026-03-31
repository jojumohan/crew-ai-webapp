create extension if not exists pgcrypto;

create table if not exists app_users (
  id text primary key,
  phone_e164 text unique,
  email text unique,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  about text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references app_users(id) on delete cascade,
  device_label text not null,
  platform text not null,
  push_token text,
  last_active_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references app_users(id) on delete cascade,
  device_id uuid not null references devices(id) on delete cascade,
  refresh_token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct', 'group')),
  title text,
  avatar_url text,
  created_by text references app_users(id) on delete set null,
  last_message_id uuid,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id text not null references app_users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin', 'owner')),
  muted_until timestamptz,
  archived_at timestamptz,
  joined_at timestamptz not null default now(),
  last_read_message_id uuid,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_user_id text not null references app_users(id) on delete cascade,
  kind text not null check (kind in ('text', 'image', 'video', 'audio', 'file', 'system')),
  ciphertext text,
  plaintext_preview text,
  reply_to_message_id uuid references messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index if not exists idx_messages_conversation_created_at
  on messages (conversation_id, created_at desc, id desc);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  storage_key text not null,
  mime_type text not null,
  size_bytes bigint not null,
  width integer,
  height integer,
  duration_ms integer,
  checksum text,
  created_at timestamptz not null default now()
);

create table if not exists message_receipts (
  message_id uuid not null references messages(id) on delete cascade,
  user_id text not null references app_users(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);

create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  initiator_user_id text not null references app_users(id) on delete cascade,
  provider_room_name text not null,
  call_type text not null check (call_type in ('voice', 'video')),
  status text not null check (status in ('ringing', 'active', 'ended', 'missed')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists call_participants (
  call_id uuid not null references calls(id) on delete cascade,
  user_id text not null references app_users(id) on delete cascade,
  joined_at timestamptz,
  left_at timestamptz,
  connection_quality text,
  primary key (call_id, user_id)
);

create table if not exists user_identity_keys (
  user_id text not null references app_users(id) on delete cascade,
  device_id uuid not null references devices(id) on delete cascade,
  identity_public_key text not null,
  signed_prekey_public text not null,
  signed_prekey_signature text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

create table if not exists one_time_prekeys (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices(id) on delete cascade,
  public_key text not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
