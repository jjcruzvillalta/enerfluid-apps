-- Reset CRM demo data (no toca configuraciones ni usuarios)
begin;

delete from crm_notifications;
delete from crm_note_mentions;
delete from crm_notes;
delete from crm_activity_contacts;
delete from crm_activities;
delete from crm_opportunity_contacts;
delete from crm_opportunities;
delete from crm_contacts;
delete from crm_clients;

with users as (
  select id, row_number() over (order by username) as rn
  from app_users
),
client_types as (
  select id, row_number() over (order by sort_order) as rn
  from crm_client_types
),
clients as (
  insert into crm_clients (name, client_type_id, city, detail, responsible_user_id, created_at, updated_at)
  select
    'Cliente Demo ' || gs,
    (select id from client_types where rn = ((gs - 1) % (select count(*) from client_types)) + 1),
    (array['Quito','Guayaquil','Cuenca','Manta','Ambato','Loja','Santo Domingo'])[((gs - 1) % 7) + 1],
    'Cliente demo generado para pruebas.',
    (select id from users where rn = ((gs - 1) % (select count(*) from users)) + 1),
    now() - ((gs - 1) * interval '12 days'),
    now() - ((gs - 1) * interval '6 days')
  from generate_series(1, 30) gs
  returning id, created_at, responsible_user_id
),
clients_index as (
  select id, created_at, responsible_user_id, row_number() over (order by created_at) as rn
  from clients
),
contacts_data as (
  select
    gs as idx,
    c.id as client_id
  from generate_series(1, 100) gs
  join clients_index c on c.rn = ((gs - 1) % 30) + 1
),
contact_rows as (
  insert into crm_contacts (client_id, name, role, phone, email, detail, created_at, updated_at)
  select
    client_id,
    'Contacto ' || idx,
    (array['Compras','Operaciones','Finanzas','Mantenimiento','Direccion'])[((idx - 1) % 5) + 1],
    '09' || lpad((idx * 917 % 100000000)::text, 8, '0'),
    'contacto' || idx || '@demo.com',
    'Contacto demo.',
    now() - ((idx - 1) * interval '5 days'),
    now() - ((idx - 1) * interval '2 days')
  from contacts_data
  returning id, client_id, created_at
),
contact_index as (
  select id, client_id, created_at, row_number() over (partition by client_id order by created_at) as rn
  from contact_rows
),
stages as (
  select id, row_number() over (order by sort_order) as rn
  from crm_opportunity_stages
),
opportunities_data as (
  select
    gs as idx,
    c.id as client_id,
    c.responsible_user_id
  from generate_series(1, 100) gs
  join clients_index c on c.rn = ((gs - 1) % 30) + 1
),
opportunity_rows as (
  insert into crm_opportunities (title, client_id, responsible_user_id, stage_id, closed_at, created_at, updated_at, value, sort_order)
  select
    'Oportunidad Demo ' || idx,
    client_id,
    responsible_user_id,
    (select id from stages where rn = ((idx - 1) % (select count(*) from stages)) + 1),
    case
      when ((idx - 1) % 4) in (2, 3) then now() - ((idx - 1) * interval '8 days') + interval '30 days'
      else null
    end,
    now() - ((idx - 1) * interval '8 days'),
    now() - ((idx - 1) * interval '3 days'),
    ((idx * 1250) % 80000) + 2500,
    idx
  from opportunities_data
  returning id, client_id
)
insert into crm_opportunity_contacts (opportunity_id, contact_id)
select o.id, c.id
from opportunity_rows o
join contact_index c on c.client_id = o.client_id
where c.rn <= 2;

with types as (
  select id, row_number() over (order by sort_order) as rn
  from crm_activity_types
),
outcomes as (
  select id, row_number() over (order by sort_order) as rn
  from crm_activity_outcomes
),
opps as (
  select id, client_id, row_number() over (order by created_at) as rn
  from crm_opportunities
),
activities_data as (
  select
    gs as idx,
    o.id as opportunity_id,
    o.client_id
  from generate_series(1, 100) gs
  join opps o on o.rn = ((gs - 1) % 100) + 1
),
activity_rows as (
  insert into crm_activities (
    activity_type_id,
    client_id,
    opportunity_id,
    responsible_user_id,
    scheduled_at,
    detail,
    outcome_id,
    created_at,
    updated_at
  )
  select
    (select id from types where rn = ((idx - 1) % (select count(*) from types)) + 1),
    client_id,
    opportunity_id,
    (select responsible_user_id from crm_clients where id = client_id),
    now() - ((idx - 1) * interval '3 days'),
    'Actividad demo ' || idx,
    (select id from outcomes where rn = ((idx - 1) % (select count(*) from outcomes)) + 1),
    now() - ((idx - 1) * interval '3 days'),
    now() - ((idx - 1) * interval '1 days')
  from activities_data
  returning id, client_id
)
insert into crm_activity_contacts (activity_id, contact_id)
select a.id, c.id
from activity_rows a
join lateral (
  select id
  from crm_contacts
  where client_id = a.client_id
  order by created_at
  limit 1
) c on true;

commit;
