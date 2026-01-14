-- Seed admin user (password: Admin123!)
insert into app_users (username, display_name, password_hash, is_active)
values ('admin', 'Admin', '$2a$10$R6aD8zZag7q6CdYb1QzyCuQnDaTgXhJeoG7ZZTFspgtPBlqBiJfUm', true)
on conflict (username) do nothing;

insert into user_roles (user_id, app_key, role)
select id, 'portal', 'admin' from app_users where username = 'admin'
on conflict (user_id, app_key) do nothing;
insert into user_roles (user_id, app_key, role)
select id, 'inventory', 'admin' from app_users where username = 'admin'
on conflict (user_id, app_key) do nothing;
insert into user_roles (user_id, app_key, role)
select id, 'crm', 'admin' from app_users where username = 'admin'
on conflict (user_id, app_key) do nothing;
insert into user_roles (user_id, app_key, role)
select id, 'users', 'admin' from app_users where username = 'admin'
on conflict (user_id, app_key) do nothing;

-- Usuarios demo CRM (password: Admin123!)
insert into app_users (username, display_name, password_hash, is_active)
values
  ('camila', 'Camila Torres', '$2a$10$R6aD8zZag7q6CdYb1QzyCuQnDaTgXhJeoG7ZZTFspgtPBlqBiJfUm', true),
  ('diego', 'Diego Mora', '$2a$10$R6aD8zZag7q6CdYb1QzyCuQnDaTgXhJeoG7ZZTFspgtPBlqBiJfUm', true),
  ('sofia', 'Sofia Luna', '$2a$10$R6aD8zZag7q6CdYb1QzyCuQnDaTgXhJeoG7ZZTFspgtPBlqBiJfUm', true),
  ('marco', 'Marco Vera', '$2a$10$R6aD8zZag7q6CdYb1QzyCuQnDaTgXhJeoG7ZZTFspgtPBlqBiJfUm', true)
on conflict (username) do nothing;

insert into user_roles (user_id, app_key, role)
select id, 'portal', 'standard' from app_users where username in ('camila', 'diego', 'sofia', 'marco')
on conflict (user_id, app_key) do nothing;
insert into user_roles (user_id, app_key, role)
select id, 'crm', 'standard' from app_users where username in ('camila', 'diego', 'sofia')
on conflict (user_id, app_key) do nothing;
insert into user_roles (user_id, app_key, role)
select id, 'crm', 'admin' from app_users where username in ('marco')
on conflict (user_id, app_key) do nothing;

-- Configuracion CRM
insert into crm_client_types (name, sort_order)
values
  ('Fabrica', 1),
  ('Contratista/Distribuidor', 2)
on conflict (name) do nothing;

insert into crm_activity_types (name, sort_order)
values
  ('Llamada', 1),
  ('Email', 2),
  ('Whatsapp', 3),
  ('Reunion presencial', 4),
  ('Reunion virtual', 5)
on conflict (name) do nothing;

insert into crm_activity_outcomes (name, is_effective, sort_order)
values
  ('Contacto efectivo', true, 1),
  ('Intento', false, 2)
on conflict (name) do nothing;

insert into crm_opportunity_stages (name, is_won, is_lost, sort_order)
values
  ('Solicitud recibida', false, false, 1),
  ('Cotizacion enviada', false, false, 2),
  ('Ganado', true, false, 3),
  ('Perdido', false, true, 4)
on conflict (name) do nothing;

-- Clientes demo
insert into crm_clients (name, client_type_id, city, detail, responsible_user_id)
values
  (
    'Andina Textiles',
    (select id from crm_client_types where name = 'Fabrica'),
    'Quito',
    'Cuenta industrial con alto volumen. Interes en compras recurrentes.',
    (select id from app_users where username = 'camila')
  ),
  (
    'Constructora Orion',
    (select id from crm_client_types where name = 'Contratista/Distribuidor'),
    'Guayaquil',
    'Obras privadas, requiere respuesta rapida en cotizaciones.',
    (select id from app_users where username = 'diego')
  ),
  (
    'Metal Norte',
    (select id from crm_client_types where name = 'Fabrica'),
    'Cuenca',
    'Cliente historico, negociaciones largas pero estables.',
    (select id from app_users where username = 'sofia')
  ),
  (
    'Distribuciones Pacifico',
    (select id from crm_client_types where name = 'Contratista/Distribuidor'),
    'Manta',
    'Busca catalogo completo y entregas semanales.',
    (select id from app_users where username = 'marco')
  );

-- Contactos demo
insert into crm_contacts (client_id, name, role, phone, email, detail)
values
  ((select id from crm_clients where name = 'Andina Textiles'), 'Carlos Mejia', 'Jefe de compras', '099111222', 'carlos@andina.ec', 'Contacto clave para renovaciones.'),
  ((select id from crm_clients where name = 'Andina Textiles'), 'Lucia Rojas', 'Finanzas', '098222333', 'lucia@andina.ec', 'Solicita condiciones de pago flexibles.'),
  ((select id from crm_clients where name = 'Constructora Orion'), 'Paula Ruiz', 'Gerente de proyectos', '097333444', 'paula@orion.ec', 'Interes en acuerdos de suministro.'),
  ((select id from crm_clients where name = 'Metal Norte'), 'Jorge Cano', 'Compras', '096444555', 'jorge@metalnorte.ec', 'Prefiere comunicacion por email.'),
  ((select id from crm_clients where name = 'Distribuciones Pacifico'), 'Valeria Luna', 'Directora comercial', '095555666', 'valeria@pacifico.ec', 'Busca precios por volumen.');

-- Oportunidades demo
insert into crm_opportunities (title, client_id, responsible_user_id, stage_id, closed_at, created_at, updated_at)
values
  (
    'Suministro trimestral de insumos',
    (select id from crm_clients where name = 'Andina Textiles'),
    (select id from app_users where username = 'camila'),
    (select id from crm_opportunity_stages where name = 'Cotizacion enviada'),
    null,
    now() - interval '35 days',
    now() - interval '5 days'
  ),
  (
    'Proyecto Torre Azul',
    (select id from crm_clients where name = 'Constructora Orion'),
    (select id from app_users where username = 'diego'),
    (select id from crm_opportunity_stages where name = 'Solicitud recibida'),
    null,
    now() - interval '20 days',
    now() - interval '2 days'
  ),
  (
    'Renovacion contrato anual',
    (select id from crm_clients where name = 'Metal Norte'),
    (select id from app_users where username = 'sofia'),
    (select id from crm_opportunity_stages where name = 'Ganado'),
    now() - interval '28 days',
    now() - interval '80 days',
    now() - interval '28 days'
  ),
  (
    'Paquete distribuidores Q3',
    (select id from crm_clients where name = 'Distribuciones Pacifico'),
    (select id from app_users where username = 'marco'),
    (select id from crm_opportunity_stages where name = 'Perdido'),
    now() - interval '55 days',
    now() - interval '120 days',
    now() - interval '55 days'
  );

-- Contactos vinculados a oportunidades
insert into crm_opportunity_contacts (opportunity_id, contact_id)
select o.id, c.id
from crm_opportunities o
join crm_contacts c on c.client_id = o.client_id;

-- Actividades demo
insert into crm_activities (activity_type_id, client_id, opportunity_id, responsible_user_id, scheduled_at, detail, outcome_id, created_at, updated_at)
values
  (
    (select id from crm_activity_types where name = 'Llamada'),
    (select id from crm_clients where name = 'Andina Textiles'),
    (select id from crm_opportunities where title = 'Suministro trimestral de insumos'),
    (select id from app_users where username = 'camila'),
    now() - interval '3 days',
    'Llamada para confirmar calendario de compras.',
    (select id from crm_activity_outcomes where name = 'Contacto efectivo'),
    now() - interval '3 days',
    now() - interval '3 days'
  ),
  (
    (select id from crm_activity_types where name = 'Email'),
    (select id from crm_clients where name = 'Constructora Orion'),
    (select id from crm_opportunities where title = 'Proyecto Torre Azul'),
    (select id from app_users where username = 'diego'),
    now() - interval '10 days',
    'Envio de propuesta tecnica.',
    (select id from crm_activity_outcomes where name = 'Intento'),
    now() - interval '10 days',
    now() - interval '10 days'
  ),
  (
    (select id from crm_activity_types where name = 'Reunion virtual'),
    (select id from crm_clients where name = 'Metal Norte'),
    (select id from crm_opportunities where title = 'Renovacion contrato anual'),
    (select id from app_users where username = 'sofia'),
    now() - interval '15 days',
    'Reunion para revision de acuerdos y renovaciones.',
    (select id from crm_activity_outcomes where name = 'Contacto efectivo'),
    now() - interval '15 days',
    now() - interval '15 days'
  ),
  (
    (select id from crm_activity_types where name = 'Whatsapp'),
    (select id from crm_clients where name = 'Distribuciones Pacifico'),
    (select id from crm_opportunities where title = 'Paquete distribuidores Q3'),
    (select id from app_users where username = 'marco'),
    now() - interval '25 days',
    'Seguimiento de precios y condiciones.',
    (select id from crm_activity_outcomes where name = 'Intento'),
    now() - interval '25 days',
    now() - interval '25 days'
  );

insert into crm_activity_contacts (activity_id, contact_id)
select a.id, c.id
from crm_activities a
join crm_contacts c on c.client_id = a.client_id;

-- Notas demo (incluye threads)
insert into crm_notes (detail, author_user_id, client_id, created_at, updated_at)
values
  (
    'Cliente solicita revisar tiempos de entrega. @diego',
    (select id from app_users where username = 'camila'),
    (select id from crm_clients where name = 'Andina Textiles'),
    now() - interval '5 days',
    now() - interval '5 days'
  );

insert into crm_notes (detail, author_user_id, client_id, parent_note_id, created_at, updated_at)
values
  (
    'Visto. Preparare propuesta con logistica. @camila',
    (select id from app_users where username = 'diego'),
    (select id from crm_clients where name = 'Andina Textiles'),
    (select id from crm_notes where detail like 'Cliente solicita revisar tiempos%'),
    now() - interval '4 days',
    now() - interval '4 days'
  );

insert into crm_notes (detail, author_user_id, opportunity_id, created_at, updated_at)
values
  (
    'Oportunidad lista para revision final. @marco',
    (select id from app_users where username = 'sofia'),
    (select id from crm_opportunities where title = 'Renovacion contrato anual'),
    now() - interval '7 days',
    now() - interval '7 days'
  );

-- Menciones y notificaciones demo
insert into crm_note_mentions (note_id, mentioned_user_id)
select n.id, u.id
from crm_notes n
join app_users u on u.username = 'diego'
where n.detail like 'Cliente solicita revisar tiempos%';

insert into crm_note_mentions (note_id, mentioned_user_id)
select n.id, u.id
from crm_notes n
join app_users u on u.username = 'camila'
where n.detail like 'Visto. Preparare propuesta%';

insert into crm_note_mentions (note_id, mentioned_user_id)
select n.id, u.id
from crm_notes n
join app_users u on u.username = 'marco'
where n.detail like 'Oportunidad lista para revision final%';

insert into crm_notifications (user_id, note_id, actor_user_id, type, is_read)
select m.mentioned_user_id, m.note_id, n.author_user_id, 'mention', false
from crm_note_mentions m
join crm_notes n on n.id = m.note_id;

-- Datos de relleno (ultimos 12 meses)
insert into crm_clients (name, client_type_id, city, detail, responsible_user_id, created_at, updated_at)
select
  'Cliente Mes ' || to_char(date_trunc('month', now() - (gs || ' months')::interval), 'YYYY-MM'),
  (select id from crm_client_types order by sort_order limit 1 offset (gs % 2)),
  (array['Quito','Guayaquil','Cuenca','Manta','Ambato'])[(gs % 5) + 1],
  'Cliente generado para pruebas de CRM.',
  (select id from app_users where username in ('camila','diego','sofia','marco') order by username limit 1 offset (gs % 4)),
  date_trunc('month', now() - (gs || ' months')::interval) + interval '3 days',
  date_trunc('month', now() - (gs || ' months')::interval) + interval '20 days'
from generate_series(0, 11) gs
where not exists (
  select 1 from crm_clients
  where name = 'Cliente Mes ' || to_char(date_trunc('month', now() - (gs || ' months')::interval), 'YYYY-MM')
);

insert into crm_contacts (client_id, name, role, phone, email, detail, created_at, updated_at)
select
  c.id,
  'Contacto ' || c.name || ' ' || v.letter,
  case when v.letter = 'A' then 'Compras' else 'Operaciones' end,
  '09' || lpad((abs(hashtext(c.name || v.letter)) % 10000000)::text, 8, '0'),
  lower(replace(c.name, ' ', '')) || lower(v.letter) || '@demo.com',
  'Contacto generado para pruebas.',
  c.created_at + interval '5 days',
  c.created_at + interval '10 days'
from crm_clients c
cross join (values ('A'), ('B')) as v(letter)
where c.name like 'Cliente Mes %'
  and not exists (
    select 1 from crm_contacts
    where client_id = c.id
      and name = 'Contacto ' || c.name || ' ' || v.letter
  );

insert into crm_opportunities (title, client_id, responsible_user_id, stage_id, closed_at, created_at, updated_at)
select
  'Oportunidad ' || to_char(c.created_at, 'YYYY-MM') || ' - ' || c.name,
  c.id,
  c.responsible_user_id,
  stage.id,
  case when stage.is_won or stage.is_lost then c.created_at + interval '25 days' else null end,
  c.created_at + interval '8 days',
  c.created_at + interval '18 days'
from crm_clients c
join lateral (
  select id, is_won, is_lost
  from crm_opportunity_stages
  order by sort_order
  limit 1 offset ((extract(month from c.created_at)::int - 1) % 4)
) stage on true
where c.name like 'Cliente Mes %'
  and not exists (
    select 1 from crm_opportunities
    where title = 'Oportunidad ' || to_char(c.created_at, 'YYYY-MM') || ' - ' || c.name
  );

insert into crm_opportunity_contacts (opportunity_id, contact_id)
select o.id, c.id
from crm_opportunities o
join crm_contacts c on c.client_id = o.client_id
where o.title like 'Oportunidad %'
  and not exists (
    select 1 from crm_opportunity_contacts
    where opportunity_id = o.id and contact_id = c.id
  );

insert into crm_activities (activity_type_id, client_id, opportunity_id, responsible_user_id, scheduled_at, detail, outcome_id, created_at, updated_at)
select
  (select id from crm_activity_types order by sort_order limit 1 offset (gs % 5)),
  o.client_id,
  o.id,
  o.responsible_user_id,
  o.created_at + (gs || ' days')::interval + interval '2 days',
  'Seguimiento mensual ' || (gs + 1),
  (select id from crm_activity_outcomes order by sort_order limit 1 offset (gs % 2)),
  o.created_at + (gs || ' days')::interval + interval '2 days',
  o.created_at + (gs || ' days')::interval + interval '2 days'
from crm_opportunities o
cross join generate_series(0, 1) gs
where o.title like 'Oportunidad %'
  and not exists (
    select 1 from crm_activities
    where opportunity_id = o.id and detail = 'Seguimiento mensual ' || (gs + 1)
  );

insert into crm_activity_contacts (activity_id, contact_id)
select a.id, c.id
from crm_activities a
join crm_contacts c on c.client_id = a.client_id
where a.detail like 'Seguimiento mensual %'
  and not exists (
    select 1 from crm_activity_contacts
    where activity_id = a.id and contact_id = c.id
  );

insert into crm_notes (detail, author_user_id, client_id, created_at, updated_at)
select
  'Nota mensual para ' || c.name,
  c.responsible_user_id,
  c.id,
  c.created_at + interval '12 days',
  c.created_at + interval '12 days'
from crm_clients c
where c.name like 'Cliente Mes %'
  and not exists (
    select 1 from crm_notes
    where client_id = c.id and detail = 'Nota mensual para ' || c.name
  );
