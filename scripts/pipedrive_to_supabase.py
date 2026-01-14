import json
import math
import html
import os
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]

FILES = {
    "organizations": "organizations-*.xlsx",
    "people": "people-*.xlsx",
    "deals": "deals-*.xlsx",
    "activities": "activities-*.xlsx",
    "notes": "notes-*.xlsx",
}


def load_env():
    env_path = ROOT / ".env.local"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if not line or line.strip().startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


def normalize_text(value):
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    text = str(value)
    text = html.unescape(text)
    text = text.replace("\u00a0", " ")
    return text.strip()


def normalize_id(value):
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    text = str(value).strip()
    if text.endswith(".0"):
        base = text[:-2]
        if base.isdigit():
            return base
    return text


def to_iso(value):
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    text = str(value).strip()
    if not text:
        return ""
    dt = pd.to_datetime(value, errors="coerce")
    if pd.isna(dt):
        return ""
    if hasattr(dt, "to_pydatetime"):
        dt = dt.to_pydatetime()
    return dt.isoformat()


def combine_date_time(date_value, time_value, fallback=""):
    date = pd.to_datetime(date_value, errors="coerce")
    if pd.isna(date):
        return fallback
    if time_value is not None and not (isinstance(time_value, float) and math.isnan(time_value)):
        time_val = pd.to_datetime(time_value, errors="coerce")
        if not pd.isna(time_val):
            date = datetime(
                date.year,
                date.month,
                date.day,
                time_val.hour,
                time_val.minute,
                time_val.second,
            )
    if hasattr(date, "to_pydatetime"):
        date = date.to_pydatetime()
    return date.isoformat()


def normalize_name(value):
    text = normalize_text(value).upper()
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^A-Z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def build_column_map(df):
    return {normalize_name(col): col for col in df.columns}


def get_column(df, col_map, *candidates):
    for candidate in candidates:
        key = normalize_name(candidate)
        if key in col_map:
            return col_map[key]
    return None


def split_tags(value):
    text = normalize_text(value)
    if not text:
        return None
    parts = [part.strip() for part in re.split(r"[;,/]+", text) if part.strip()]
    if not parts:
        return None
    return list(dict.fromkeys(parts))


def parse_number(value):
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = normalize_text(value)
    if not text:
        return None
    text = text.replace(" ", "").replace(",", "")
    try:
        return float(text)
    except ValueError:
        return None


def parse_duration_minutes(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    text = normalize_text(value)
    if not text:
        return None
    if ":" in text:
        parts = text.split(":")
        try:
            hours = int(parts[0])
            minutes = int(parts[1]) if len(parts) > 1 else 0
            return hours * 60 + minutes
        except ValueError:
            return None
    try:
        return int(text)
    except ValueError:
        return None


def parse_bool(value):
    if value is None:
        return False
    text = normalize_text(value).lower()
    return text in {"si", "sí", "yes", "true", "1", "x"}


def supabase_request(method, table, query="", payload=None, prefer=None):
    url = f"{SUPABASE_URL}/rest/v1/{table}{query}"
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = Request(url, data=data, method=method)
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    if prefer:
        req.add_header("Prefer", prefer)
    try:
        with urlopen(req) as response:
            raw = response.read()
            if not raw:
                return []
            return json.loads(raw.decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"{method} {url} -> {exc.code}: {detail}") from exc


def chunked(items, size=500):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def upsert_rows(table, rows, conflict):
    if not rows:
        return
    for batch in chunked(rows, 500):
        supabase_request(
            "POST",
            table,
            f"?on_conflict={conflict}",
            payload=batch,
            prefer="resolution=merge-duplicates",
        )


def fetch_id_map(table):
    mapping = {}
    offset = 0
    while True:
        rows = supabase_request(
            "GET", table, f"?select=id,external_id&limit=1000&offset={offset}"
        )
        if not rows:
            break
        for row in rows:
            if row.get("external_id"):
                mapping[str(row["external_id"])] = row["id"]
        offset += len(rows)
    return mapping


load_env()
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.")


def find_file(pattern):
    matches = list(ROOT.glob(pattern))
    if not matches:
        raise SystemExit(f"No se encontro archivo para patron {pattern}")
    return matches[0]


org_df = pd.read_excel(find_file(FILES["organizations"]))
people_df = pd.read_excel(find_file(FILES["people"]))
deals_df = pd.read_excel(find_file(FILES["deals"]))
activities_df = pd.read_excel(find_file(FILES["activities"]))
notes_df = pd.read_excel(find_file(FILES["notes"]))

org_cols = build_column_map(org_df)
people_cols = build_column_map(people_df)
deals_cols = build_column_map(deals_df)
activities_cols = build_column_map(activities_df)
notes_cols = build_column_map(notes_df)

clients = []
contacts = []
deals = []
activities = []
notes = []

for _, row in org_df.iterrows():
    external_id = normalize_id(row.get(get_column(org_df, org_cols, "ID")))
    name = normalize_text(row.get(get_column(org_df, org_cols, "Nombre")))
    if not external_id or not name:
        continue
    created_at = to_iso(row.get(get_column(org_df, org_cols, "Organizacion creada")))
    updated_at = to_iso(row.get(get_column(org_df, org_cols, "Hora de actualizacion")))
    address = normalize_text(row.get(get_column(org_df, org_cols, "Direccion completa/combinada de Direccion")))
    if not address:
        address = normalize_text(row.get(get_column(org_df, org_cols, "Direccion")))
    clients.append(
        {
            "external_id": external_id,
            "name": name,
            "industry": normalize_text(row.get(get_column(org_df, org_cols, "Sub-sector"))),
            "city": normalize_text(
                row.get(get_column(org_df, org_cols, "Ciudad/pueblo/poblacion/localidad de Direccion"))
            ),
            "owner": normalize_text(row.get(get_column(org_df, org_cols, "Propietario"))),
            "client_type": normalize_text(row.get(get_column(org_df, org_cols, "Tipo de cliente"))),
            "relation": normalize_text(row.get(get_column(org_df, org_cols, "Relacion"))),
            "potential": normalize_text(row.get(get_column(org_df, org_cols, "Potencial"))),
            "tags": split_tags(row.get(get_column(org_df, org_cols, "Etiquetas"))),
            "address": address,
            "state": normalize_text(row.get(get_column(org_df, org_cols, "Estado/municipio de Direccion"))),
            "country": normalize_text(row.get(get_column(org_df, org_cols, "Pais de Direccion"))),
            "postal_code": normalize_text(row.get(get_column(org_df, org_cols, "Codigo postal de Direccion"))),
            "meta": {
                "boilers": normalize_text(row.get(get_column(org_df, org_cols, "Calderas Instaladas"))),
                "burners": normalize_text(row.get(get_column(org_df, org_cols, "Quemadores instalados"))),
                "lat": normalize_text(row.get(get_column(org_df, org_cols, "Latitud de Direccion"))),
                "lng": normalize_text(row.get(get_column(org_df, org_cols, "Longitud de Direccion"))),
            },
            "created_at": created_at or None,
            "updated_at": updated_at or created_at or None,
        }
    )

for _, row in people_df.iterrows():
    external_id = normalize_id(row.get(get_column(people_df, people_cols, "ID")))
    if not external_id:
        continue
    name = normalize_text(row.get(get_column(people_df, people_cols, "Nombre")))
    if not name:
        first = normalize_text(row.get(get_column(people_df, people_cols, "Nombre.1")))
        last = normalize_text(row.get(get_column(people_df, people_cols, "Apellidos")))
        name = " ".join([part for part in [first, last] if part]).strip()
    if not name:
        continue
    phone = (
        normalize_text(row.get(get_column(people_df, people_cols, "Telefono - Movil")))
        or normalize_text(row.get(get_column(people_df, people_cols, "Telefono - Trabajo")))
        or normalize_text(row.get(get_column(people_df, people_cols, "Telefono - Personal")))
        or normalize_text(row.get(get_column(people_df, people_cols, "Telefono - Otro")))
    )
    email = normalize_text(row.get(get_column(people_df, people_cols, "Correo electronico - Trabajo")))
    if not email:
        email = normalize_text(row.get(get_column(people_df, people_cols, "Correo electronico - Personal")))
    if not email:
        email = normalize_text(row.get(get_column(people_df, people_cols, "Correo electronico - Otro")))
    created_at = to_iso(row.get(get_column(people_df, people_cols, "Persona creada")))
    updated_at = to_iso(row.get(get_column(people_df, people_cols, "Hora de actualizacion")))
    client_external_id = normalize_id(
        row.get(get_column(people_df, people_cols, "ID de la organizacion"))
    )
    contacts.append(
        {
            "external_id": external_id,
            "client_external_id": client_external_id,
            "name": name,
            "role": normalize_text(row.get(get_column(people_df, people_cols, "Cargo"))),
            "phone": phone,
            "email": email,
            "area": normalize_text(row.get(get_column(people_df, people_cols, "Area"))),
            "tags": split_tags(row.get(get_column(people_df, people_cols, "Etiquetas"))),
            "meta": {
                "phones": {
                    "work": normalize_text(row.get(get_column(people_df, people_cols, "Telefono - Trabajo"))),
                    "personal": normalize_text(row.get(get_column(people_df, people_cols, "Telefono - Personal"))),
                    "mobile": normalize_text(row.get(get_column(people_df, people_cols, "Telefono - Movil"))),
                    "other": normalize_text(row.get(get_column(people_df, people_cols, "Telefono - Otro"))),
                },
                "emails": {
                    "work": normalize_text(row.get(get_column(people_df, people_cols, "Correo electronico - Trabajo"))),
                    "personal": normalize_text(row.get(get_column(people_df, people_cols, "Correo electronico - Personal"))),
                    "other": normalize_text(row.get(get_column(people_df, people_cols, "Correo electronico - Otro"))),
                },
            },
            "created_at": created_at or None,
            "updated_at": updated_at or created_at or None,
        }
    )

contact_client_map = {c["external_id"]: c.get("client_external_id") for c in contacts}

for _, row in deals_df.iterrows():
    external_id = normalize_id(row.get(get_column(deals_df, deals_cols, "ID")))
    name = normalize_text(row.get(get_column(deals_df, deals_cols, "Titulo")))
    if not external_id or not name:
        continue
    client_external_id = normalize_id(
        row.get(get_column(deals_df, deals_cols, "ID de la organizacion"))
    )
    contact_external_id = normalize_id(
        row.get(get_column(deals_df, deals_cols, "ID de la persona de contacto"))
    )
    if not client_external_id and contact_external_id:
        client_external_id = contact_client_map.get(contact_external_id, "")
    created_at = to_iso(row.get(get_column(deals_df, deals_cols, "Trato creado")))
    updated_at = to_iso(row.get(get_column(deals_df, deals_cols, "Hora de actualizacion")))
    deals.append(
        {
            "external_id": external_id,
            "client_external_id": client_external_id,
            "contact_external_id": contact_external_id,
            "name": name,
            "stage": normalize_text(row.get(get_column(deals_df, deals_cols, "Etapa"))),
            "status": normalize_text(row.get(get_column(deals_df, deals_cols, "Estado"))),
            "value": parse_number(row.get(get_column(deals_df, deals_cols, "Valor"))),
            "currency": normalize_text(row.get(get_column(deals_df, deals_cols, "Moneda de Valor"))),
            "weighted_value": parse_number(row.get(get_column(deals_df, deals_cols, "Valor ponderado"))),
            "probability": parse_number(row.get(get_column(deals_df, deals_cols, "Probabilidad"))),
            "pipeline": normalize_text(row.get(get_column(deals_df, deals_cols, "Embudo"))),
            "owner": normalize_text(row.get(get_column(deals_df, deals_cols, "Propietario"))),
            "source": normalize_text(row.get(get_column(deals_df, deals_cols, "Origen de la fuente"))),
            "source_channel": normalize_text(row.get(get_column(deals_df, deals_cols, "Canal de la fuente"))),
            "lost_reason": normalize_text(row.get(get_column(deals_df, deals_cols, "Motivo de la perdida"))),
            "expected_close_date": to_iso(
                row.get(get_column(deals_df, deals_cols, "Fecha prevista de cierre"))
            )[:10]
            if row.get(get_column(deals_df, deals_cols, "Fecha prevista de cierre"))
            else None,
            "close_date": to_iso(row.get(get_column(deals_df, deals_cols, "Trato cerrado el")))[:10]
            if row.get(get_column(deals_df, deals_cols, "Trato cerrado el"))
            else None,
            "last_stage_change_at": to_iso(
                row.get(get_column(deals_df, deals_cols, "Ultimo cambio de la etapa"))
            ),
            "meta": {
                "product_name": normalize_text(row.get(get_column(deals_df, deals_cols, "Nombre del producto"))),
                "product_amount": parse_number(row.get(get_column(deals_df, deals_cols, "Monto del producto"))),
                "product_qty": parse_number(row.get(get_column(deals_df, deals_cols, "Cantidad de producto"))),
            },
            "created_at": created_at or None,
            "updated_at": updated_at or created_at or None,
        }
    )

deal_client_map = {d["external_id"]: d.get("client_external_id") for d in deals}

for _, row in activities_df.iterrows():
    external_id = normalize_id(row.get(get_column(activities_df, activities_cols, "ID")))
    if not external_id:
        continue
    client_external_id = normalize_id(
        row.get(get_column(activities_df, activities_cols, "ID de la organizacion"))
    )
    contact_external_id = normalize_id(
        row.get(get_column(activities_df, activities_cols, "ID de la persona de contacto"))
    )
    deal_external_id = normalize_id(row.get(get_column(activities_df, activities_cols, "ID del trato")))
    if not client_external_id and deal_external_id:
        client_external_id = deal_client_map.get(deal_external_id, "")
    if not client_external_id and contact_external_id:
        client_external_id = contact_client_map.get(contact_external_id, "")
    due_at = combine_date_time(
        row.get(get_column(activities_df, activities_cols, "Fecha de vencimiento")),
        row.get(get_column(activities_df, activities_cols, "Hora de vencimiento")),
        fallback="",
    )
    completed_at = to_iso(row.get(get_column(activities_df, activities_cols, "Hora en que se marco como completada")))
    title = normalize_text(row.get(get_column(activities_df, activities_cols, "Asunto")))
    activity_type = normalize_text(row.get(get_column(activities_df, activities_cols, "Tipo")))
    if not title:
        title = activity_type or "Actividad"
    outcome = "completada" if parse_bool(row.get(get_column(activities_df, activities_cols, "Finalizada"))) else "pendiente"
    created_at = to_iso(
        row.get(get_column(activities_df, activities_cols, "Hora de adicion", "Hora de anadicion"))
    )
    activities.append(
        {
            "external_id": external_id,
            "client_external_id": client_external_id,
            "contact_external_id": contact_external_id,
            "deal_external_id": deal_external_id,
            "title": title,
            "type": activity_type,
            "outcome": outcome,
            "notes": normalize_text(row.get(get_column(activities_df, activities_cols, "Nota"))),
            "due_at": due_at or None,
            "completed_at": completed_at or None,
            "duration_minutes": parse_duration_minutes(
                row.get(get_column(activities_df, activities_cols, "Duracion"))
            ),
            "location": normalize_text(
                row.get(get_column(activities_df, activities_cols, "Direccion completa/combinada de Ubicacion"))
            )
            or normalize_text(row.get(get_column(activities_df, activities_cols, "Ubicacion"))),
            "priority": normalize_text(row.get(get_column(activities_df, activities_cols, "Prioridad"))),
            "owner": normalize_text(row.get(get_column(activities_df, activities_cols, "Asignada al usuario"))),
            "meta": {
                "public_description": normalize_text(
                    row.get(get_column(activities_df, activities_cols, "Descripcion publica"))
                ),
                "free_busy": normalize_text(
                    row.get(get_column(activities_df, activities_cols, "Libre/ocupado"))
                ),
                "prospect": normalize_text(row.get(get_column(activities_df, activities_cols, "Prospecto"))),
                "project": normalize_text(row.get(get_column(activities_df, activities_cols, "Proyecto"))),
            },
            "created_at": created_at or None,
            "updated_at": to_iso(row.get(get_column(activities_df, activities_cols, "Hora de actualizacion")))
            or created_at
            or None,
        }
    )

for _, row in notes_df.iterrows():
    external_id = normalize_id(row.get(get_column(notes_df, notes_cols, "ID")))
    if not external_id:
        continue
    client_external_id = normalize_id(
        row.get(get_column(notes_df, notes_cols, "ID de la organizacion"))
    )
    contact_external_id = normalize_id(
        row.get(get_column(notes_df, notes_cols, "ID de la persona de contacto"))
    )
    deal_external_id = normalize_id(row.get(get_column(notes_df, notes_cols, "ID del trato")))
    created_at = to_iso(row.get(get_column(notes_df, notes_cols, "Hora de adicion")))
    updated_at = to_iso(row.get(get_column(notes_df, notes_cols, "Hora de actualizacion")))
    is_pinned = (
        parse_bool(row.get(get_column(notes_df, notes_cols, "La nota esta anclada al trato")))
        or parse_bool(row.get(get_column(notes_df, notes_cols, "La nota esta anclada a la organizacion")))
        or parse_bool(row.get(get_column(notes_df, notes_cols, "La nota esta anclada a la persona")))
    )
    notes.append(
        {
            "external_id": external_id,
            "client_external_id": client_external_id,
            "contact_external_id": contact_external_id,
            "deal_external_id": deal_external_id,
            "title": normalize_text(row.get(get_column(notes_df, notes_cols, "Titulo"))),
            "content": normalize_text(row.get(get_column(notes_df, notes_cols, "Contenido"))),
            "owner": normalize_text(row.get(get_column(notes_df, notes_cols, "Usuario"))),
            "is_pinned": is_pinned,
            "created_at": created_at or None,
            "updated_at": updated_at or created_at or None,
        }
    )

print(f"Clientes: {len(clients)} | Contactos: {len(contacts)} | Negocios: {len(deals)} | Actividades: {len(activities)} | Notas: {len(notes)}")

print("Upsert clientes...")
upsert_rows("crm_clients", clients, "external_id")
client_id_map = fetch_id_map("crm_clients")

print("Upsert contactos...")
contact_rows = []
for row in contacts:
    client_id = client_id_map.get(row.get("client_external_id") or "")
    contact_rows.append(
        {
            "external_id": row["external_id"],
            "client_id": client_id,
            "name": row["name"],
            "role": row.get("role"),
            "phone": row.get("phone"),
            "email": row.get("email"),
            "area": row.get("area"),
            "tags": row.get("tags"),
            "meta": row.get("meta"),
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
        }
    )
upsert_rows("crm_contacts", contact_rows, "external_id")
contact_id_map = fetch_id_map("crm_contacts")

print("Upsert oportunidades...")
deal_rows = []
for row in deals:
    client_id = client_id_map.get(row.get("client_external_id") or "")
    contact_id = contact_id_map.get(row.get("contact_external_id") or "")
    deal_rows.append(
        {
            "external_id": row["external_id"],
            "client_id": client_id,
            "contact_id": contact_id,
            "name": row["name"],
            "stage": row.get("stage") or None,
            "status": row.get("status") or None,
            "value": row.get("value"),
            "currency": row.get("currency") or None,
            "weighted_value": row.get("weighted_value"),
            "probability": row.get("probability"),
            "pipeline": row.get("pipeline") or None,
            "owner": row.get("owner") or None,
            "source": row.get("source") or None,
            "source_channel": row.get("source_channel") or None,
            "lost_reason": row.get("lost_reason") or None,
            "expected_close_date": row.get("expected_close_date"),
            "close_date": row.get("close_date"),
            "last_stage_change_at": row.get("last_stage_change_at"),
            "meta": row.get("meta"),
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
        }
    )
upsert_rows("crm_opportunities", deal_rows, "external_id")
deal_id_map = fetch_id_map("crm_opportunities")

print("Upsert actividades...")
activity_rows = []
for row in activities:
    client_id = client_id_map.get(row.get("client_external_id") or "")
    contact_id = contact_id_map.get(row.get("contact_external_id") or "")
    opportunity_id = deal_id_map.get(row.get("deal_external_id") or "")
    activity_rows.append(
        {
            "external_id": row["external_id"],
            "client_id": client_id,
            "contact_id": contact_id,
            "opportunity_id": opportunity_id,
            "title": row.get("title"),
            "type": row.get("type") or None,
            "outcome": row.get("outcome") or None,
            "notes": row.get("notes") or None,
            "due_at": row.get("due_at"),
            "completed_at": row.get("completed_at"),
            "duration_minutes": row.get("duration_minutes"),
            "location": row.get("location") or None,
            "priority": row.get("priority") or None,
            "owner": row.get("owner") or None,
            "meta": row.get("meta"),
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
        }
    )
upsert_rows("crm_activities", activity_rows, "external_id")
activity_id_map = fetch_id_map("crm_activities")

print("Upsert notas...")
note_rows = []
for row in notes:
    client_id = client_id_map.get(row.get("client_external_id") or "")
    contact_id = contact_id_map.get(row.get("contact_external_id") or "")
    opportunity_id = deal_id_map.get(row.get("deal_external_id") or "")
    note_rows.append(
        {
            "external_id": row["external_id"],
            "client_id": client_id,
            "contact_id": contact_id,
            "opportunity_id": opportunity_id,
            "activity_id": activity_id_map.get(row.get("activity_external_id") or ""),
            "title": row.get("title") or None,
            "content": row.get("content") or None,
            "owner": row.get("owner") or None,
            "is_pinned": bool(row.get("is_pinned")),
            "meta": row.get("meta") or {},
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
        }
    )
upsert_rows("crm_notes", note_rows, "external_id")

print("Import finalizado.")
