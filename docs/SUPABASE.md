# Supabase

## Configuracion en codigo
- Server client: `src/lib/supabase/server.ts`
- Env requeridas:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- El front no usa Supabase Auth.

## Esquema recomendado

### Extensiones
```
create extension if not exists pgcrypto;
```

### Usuarios y sesiones
```
create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  display_name text,
  password_hash text not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  app_key text not null,
  role text not null check (role in ('admin','standard')),
  created_at timestamptz default now(),
  unique (user_id, app_key)
);

create table if not exists app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
```

### Inventario (tablas actuales)
```
create table if not exists movimientos (
  id bigserial primary key,
  date timestamptz,
  item text,
  descripcion text,
  cantidad numeric,
  total numeric,
  cx_unit numeric,
  pvp_total numeric,
  referencia text,
  persona text,
  mot text,
  tipo_movimiento text
);

create table if not exists ventas (
  id bigserial primary key,
  date timestamptz,
  item text,
  unidades numeric,
  venta_bruta numeric,
  costo_total numeric,
  descuento_total numeric,
  persona text
);

create table if not exists listado_items (
  id bigserial primary key,
  code text,
  descripcion text,
  stock_total numeric,
  costo_promedio numeric,
  ultimo_costo numeric,
  costo_reposicion numeric,
  marca text,
  linea text,
  pvp1 numeric
);

create table if not exists catalogo_items (
  id bigserial primary key,
  sku text,
  nombre text,
  marca_visual text,
  marca_real text
);

create table if not exists upload_logs (
  id bigserial primary key,
  type text,
  row_count integer,
  file_name text,
  uploaded_at timestamptz default now()
);
```

### CRM
```
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
```

## Semillas iniciales (ejemplo)
Se incluye `supabase/seed.sql` con un admin inicial:
- usuario: `admin`
- clave: `Admin123!`

## RLS
- Si solo se accede via service role, se puede desactivar RLS en estas tablas.
- Si se habilita RLS, crea policies para el rol anon o usa roles dedicados.

Ejemplo para desactivar RLS:
```
alter table app_users disable row level security;
alter table user_roles disable row level security;
alter table app_sessions disable row level security;
alter table movimientos disable row level security;
alter table ventas disable row level security;
alter table listado_items disable row level security;
alter table catalogo_items disable row level security;
alter table upload_logs disable row level security;
alter table crm_clients disable row level security;
alter table crm_contacts disable row level security;
alter table crm_opportunities disable row level security;
alter table crm_activities disable row level security;
alter table crm_notes disable row level security;
alter table crm_client_types disable row level security;
alter table crm_activity_types disable row level security;
alter table crm_activity_outcomes disable row level security;
alter table crm_opportunity_stages disable row level security;
alter table crm_opportunity_contacts disable row level security;
alter table crm_activity_contacts disable row level security;
alter table crm_note_mentions disable row level security;
alter table crm_notifications disable row level security;
```
