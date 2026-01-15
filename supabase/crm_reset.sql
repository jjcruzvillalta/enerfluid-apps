-- CRM reset: elimina tablas actuales y recrea el esquema desde cero.
-- Ejecutar manualmente en Supabase (SQL editor) cuando confirmes el borrado.

-- Drop en orden para limpiar dependencias
drop table if exists crm_notifications cascade;
drop table if exists crm_note_mentions cascade;
drop table if exists crm_notes cascade;
drop table if exists crm_activity_contacts cascade;
drop table if exists crm_opportunity_contacts cascade;
drop table if exists crm_activities cascade;
drop table if exists crm_opportunities cascade;
drop table if exists crm_contacts cascade;
drop table if exists crm_clients cascade;
drop table if exists crm_activity_outcomes cascade;
drop table if exists crm_activity_types cascade;
drop table if exists crm_opportunity_stages cascade;
drop table if exists crm_client_types cascade;

-- Configuracion editable
create table if not exists crm_client_types (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crm_activity_types (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crm_activity_outcomes (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_effective boolean default false,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crm_opportunity_stages (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_active boolean default true,
  is_won boolean default false,
  is_lost boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint crm_opportunity_stages_won_lost check (not (is_won and is_lost))
);

-- Entidades principales
create table if not exists crm_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_type_id uuid references crm_client_types(id) on delete set null,
  city text,
  detail text,
  responsible_user_id uuid references app_users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crm_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references crm_clients(id) on delete cascade,
  name text not null,
  role text,
  phone text,
  email text,
  detail text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  client_id uuid references crm_clients(id) on delete set null,
  responsible_user_id uuid references app_users(id) on delete set null,
  stage_id uuid references crm_opportunity_stages(id) on delete set null,
  value numeric,
  sort_order numeric,
  closed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crm_opportunity_contacts (
  opportunity_id uuid not null references crm_opportunities(id) on delete cascade,
  contact_id uuid not null references crm_contacts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (opportunity_id, contact_id)
);

create table if not exists crm_activities (
  id uuid primary key default gen_random_uuid(),
  activity_type_id uuid references crm_activity_types(id) on delete set null,
  client_id uuid references crm_clients(id) on delete set null,
  opportunity_id uuid references crm_opportunities(id) on delete set null,
  responsible_user_id uuid references app_users(id) on delete set null,
  scheduled_at timestamptz not null,
  detail text,
  outcome_id uuid references crm_activity_outcomes(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crm_activity_contacts (
  activity_id uuid not null references crm_activities(id) on delete cascade,
  contact_id uuid not null references crm_contacts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (activity_id, contact_id)
);

create table if not exists crm_notes (
  id uuid primary key default gen_random_uuid(),
  detail text not null,
  author_user_id uuid references app_users(id) on delete set null,
  client_id uuid references crm_clients(id) on delete cascade,
  contact_id uuid references crm_contacts(id) on delete cascade,
  opportunity_id uuid references crm_opportunities(id) on delete cascade,
  activity_id uuid references crm_activities(id) on delete cascade,
  parent_note_id uuid references crm_notes(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint crm_notes_single_target check (
    (case when client_id is not null then 1 else 0 end
    + case when contact_id is not null then 1 else 0 end
    + case when opportunity_id is not null then 1 else 0 end
    + case when activity_id is not null then 1 else 0 end) = 1
  )
);

create table if not exists crm_note_mentions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references crm_notes(id) on delete cascade,
  mentioned_user_id uuid not null references app_users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (note_id, mentioned_user_id)
);

create table if not exists crm_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  note_id uuid references crm_notes(id) on delete cascade,
  actor_user_id uuid references app_users(id) on delete set null,
  type text not null default 'mention',
  is_read boolean default false,
  created_at timestamptz default now()
);

-- Indexes recomendados
create index if not exists crm_contacts_client_idx on crm_contacts(client_id);
create index if not exists crm_clients_responsible_idx on crm_clients(responsible_user_id);
create index if not exists crm_opportunities_client_idx on crm_opportunities(client_id);
create index if not exists crm_opportunities_stage_idx on crm_opportunities(stage_id);
create index if not exists crm_activities_client_idx on crm_activities(client_id);
create index if not exists crm_activities_scheduled_idx on crm_activities(scheduled_at);
create index if not exists crm_notes_parent_idx on crm_notes(parent_note_id);
