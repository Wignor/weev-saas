-- WeevBot — Schema Supabase
-- Cole este SQL no SQL Editor do Supabase e execute

create table if not exists conversations (
  id              text primary key,           -- número do WhatsApp (ex: 5511999999999)
  push_name       text,                       -- nome exibido no WhatsApp
  status          text not null default 'waiting',  -- 'active' | 'paused' | 'waiting'
  last_message    text,
  last_message_at timestamptz,
  created_at      timestamptz default now()
);

create table if not exists messages (
  id              text primary key,
  conversation_id text not null references conversations(id) on delete cascade,
  role            text not null,              -- 'user' | 'assistant' | 'human'
  content         text not null,
  created_at      timestamptz default now()
);

create index if not exists messages_conversation_id_idx on messages (conversation_id, created_at);
create index if not exists conversations_last_message_at_idx on conversations (last_message_at desc);

-- Row Level Security (opcional — desative se não usar auth)
alter table conversations enable row level security;
alter table messages enable row level security;

-- Política: service_role tem acesso total (usado pelo backend)
create policy "service_role full access conversations"
  on conversations for all using (true) with check (true);

create policy "service_role full access messages"
  on messages for all using (true) with check (true);
