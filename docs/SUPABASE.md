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
create table if not exists crm_clients (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  name text not null,
  industry text,
  city text,
  owner text,
  client_type text,
  relation text,
  potential text,
  tags text[],
  address text,
  state text,
  country text,
  postal_code text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crm_contacts (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  client_id uuid references crm_clients(id) on delete cascade,
  name text not null,
  role text,
  phone text,
  email text,
  area text,
  tags text[],
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  client_id uuid references crm_clients(id) on delete set null,
  contact_id uuid references crm_contacts(id) on delete set null,
  name text not null,
  stage text,
  status text,
  value numeric,
  weighted_value numeric,
  probability numeric,
  currency text,
  pipeline text,
  owner text,
  source text,
  source_channel text,
  lost_reason text,
  expected_close_date date,
  close_date date,
  last_stage_change_at timestamptz,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crm_activities (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  client_id uuid references crm_clients(id) on delete set null,
  contact_id uuid references crm_contacts(id) on delete set null,
  opportunity_id uuid references crm_opportunities(id) on delete set null,
  title text not null,
  type text,
  outcome text,
  notes text,
  status text,
  due_at timestamptz,
  completed_at timestamptz,
  duration_minutes integer,
  location text,
  priority text,
  owner text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crm_notes (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  title text,
  content text,
  client_id uuid references crm_clients(id) on delete set null,
  contact_id uuid references crm_contacts(id) on delete set null,
  opportunity_id uuid references crm_opportunities(id) on delete set null,
  activity_id uuid references crm_activities(id) on delete set null,
  owner text,
  is_pinned boolean default false,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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
```
