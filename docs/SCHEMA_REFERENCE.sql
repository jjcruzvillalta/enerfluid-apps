-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.app_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT app_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT app_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.app_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  display_name text,
  password_hash text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT app_users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.catalogo_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  sku text NOT NULL,
  nombre text,
  marca_visual text,
  marca_real text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT catalogo_items_pkey PRIMARY KEY (id)
);
CREATE TABLE public.crm_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  activity_type_id uuid,
  client_id uuid,
  opportunity_id uuid,
  responsible_user_id uuid,
  scheduled_at timestamp with time zone NOT NULL,
  detail text,
  outcome_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crm_activities_pkey PRIMARY KEY (id),
  CONSTRAINT crm_activities_activity_type_id_fkey FOREIGN KEY (activity_type_id) REFERENCES public.crm_activity_types(id),
  CONSTRAINT crm_activities_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.crm_clients(id),
  CONSTRAINT crm_activities_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.crm_opportunities(id),
  CONSTRAINT crm_activities_responsible_user_id_fkey FOREIGN KEY (responsible_user_id) REFERENCES public.app_users(id),
  CONSTRAINT crm_activities_outcome_id_fkey FOREIGN KEY (outcome_id) REFERENCES public.crm_activity_outcomes(id)
);
CREATE TABLE public.crm_activity_contacts (
  activity_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crm_activity_contacts_pkey PRIMARY KEY (activity_id, contact_id),
  CONSTRAINT crm_activity_contacts_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.crm_activities(id),
  CONSTRAINT crm_activity_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id)
);
CREATE TABLE public.crm_activity_outcomes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_effective boolean DEFAULT false,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crm_activity_outcomes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.crm_activity_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crm_activity_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.crm_client_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crm_client_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.crm_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_type_id uuid,
  city text,
  detail text,
  responsible_user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crm_clients_pkey PRIMARY KEY (id),
  CONSTRAINT crm_clients_client_type_id_fkey FOREIGN KEY (client_type_id) REFERENCES public.crm_client_types(id),
  CONSTRAINT crm_clients_responsible_user_id_fkey FOREIGN KEY (responsible_user_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.crm_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  name text NOT NULL,
  role text,
  phone text,
  email text,
  detail text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crm_contacts_pkey PRIMARY KEY (id),
  CONSTRAINT crm_contacts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.crm_clients(id)
);
CREATE TABLE public.crm_note_mentions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL,
  mentioned_user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crm_note_mentions_pkey PRIMARY KEY (id),
  CONSTRAINT crm_note_mentions_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.crm_notes(id),
  CONSTRAINT crm_note_mentions_mentioned_user_id_fkey FOREIGN KEY (mentioned_user_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.crm_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  detail text NOT NULL,
  author_user_id uuid,
  client_id uuid,
  contact_id uuid,
  opportunity_id uuid,
  activity_id uuid,
  parent_note_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crm_notes_pkey PRIMARY KEY (id),
  CONSTRAINT crm_notes_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES public.app_users(id),
  CONSTRAINT crm_notes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.crm_clients(id),
  CONSTRAINT crm_notes_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id),
  CONSTRAINT crm_notes_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.crm_opportunities(id),
  CONSTRAINT crm_notes_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.crm_activities(id),
  CONSTRAINT crm_notes_parent_note_id_fkey FOREIGN KEY (parent_note_id) REFERENCES public.crm_notes(id)
);
CREATE TABLE public.crm_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  note_id uuid,
  actor_user_id uuid,
  type text NOT NULL DEFAULT 'mention'::text,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crm_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT crm_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id),
  CONSTRAINT crm_notifications_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.crm_notes(id),
  CONSTRAINT crm_notifications_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.crm_opportunities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  client_id uuid,
  responsible_user_id uuid,
  stage_id uuid,
  closed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crm_opportunities_pkey PRIMARY KEY (id),
  CONSTRAINT crm_opportunities_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.crm_clients(id),
  CONSTRAINT crm_opportunities_responsible_user_id_fkey FOREIGN KEY (responsible_user_id) REFERENCES public.app_users(id),
  CONSTRAINT crm_opportunities_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.crm_opportunity_stages(id)
);
CREATE TABLE public.crm_opportunity_contacts (
  opportunity_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crm_opportunity_contacts_pkey PRIMARY KEY (opportunity_id, contact_id),
  CONSTRAINT crm_opportunity_contacts_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.crm_opportunities(id),
  CONSTRAINT crm_opportunity_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id)
);
CREATE TABLE public.crm_opportunity_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  is_won boolean DEFAULT false,
  is_lost boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crm_opportunity_stages_pkey PRIMARY KEY (id)
);
CREATE TABLE public.listado_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  code text NOT NULL,
  descripcion text,
  stock_total numeric,
  costo_promedio numeric,
  ultimo_costo numeric,
  costo_reposicion numeric,
  marca text,
  linea text,
  pvp1 numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT listado_items_pkey PRIMARY KEY (id)
);
CREATE TABLE public.movimientos (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  date timestamp with time zone NOT NULL,
  item text NOT NULL,
  descripcion text,
  cantidad numeric,
  total numeric,
  cx_unit numeric,
  pvp_total numeric,
  referencia text,
  persona text,
  mot text,
  tipo_movimiento text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT movimientos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.upload_logs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  type text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  file_name text,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT upload_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  app_key text NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['admin'::text, 'standard'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.ventas (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  date timestamp with time zone NOT NULL,
  item text NOT NULL,
  unidades numeric,
  venta_bruta numeric,
  costo_total numeric,
  descuento_total numeric,
  persona text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ventas_pkey PRIMARY KEY (id)
);
