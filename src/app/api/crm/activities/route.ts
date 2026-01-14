import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessionFromRequest, hasAccess } from "@/lib/auth";

const buildStatus = (row: { completed_at?: string | null; outcome?: string | null }) => {
  if (row.completed_at) return "completada";
  if (row.outcome) return row.outcome;
  return "pendiente";
};

export async function GET(req: Request) {
  const session = await getSessionFromRequest();
  if (!session) return new NextResponse("No autenticado", { status: 401 });
  if (!hasAccess(session.roles, "crm", "standard")) {
    return new NextResponse("Sin acceso", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") || "").trim();
  const status = String(searchParams.get("status") || "").trim();
  const clientId = String(searchParams.get("clientId") || "").trim();

  try {
    let query = supabaseServer
      .from("crm_activities")
      .select(
        "id,title,type,outcome,notes,due_at,completed_at,owner,client_id,contact_id,opportunity_id,created_at"
      )
      .order("due_at", { ascending: false });

    if (q) query = query.ilike("title", `%${q}%`);
    if (clientId) query = query.eq("client_id", clientId);

    const { data: activities, error } = await query;
    if (error) return new NextResponse("Error al cargar actividades", { status: 500 });

    const filtered = (activities || []).filter((row) => {
      if (!status) return true;
      return buildStatus(row).toLowerCase() === status.toLowerCase();
    });

    const clientIds = Array.from(new Set(filtered.map((row) => row.client_id).filter(Boolean)));
    const clientMap = new Map<string, string>();
    if (clientIds.length) {
      const { data: clientRows } = await supabaseServer
        .from("crm_clients")
        .select("id,name")
        .in("id", clientIds);
      (clientRows || []).forEach((client) => clientMap.set(client.id, client.name));
    }

    const payload = filtered.map((row) => ({
      ...row,
      status: buildStatus(row),
      client_name: row.client_id ? clientMap.get(row.client_id) || "-" : "-",
    }));

    return NextResponse.json({ activities: payload });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al cargar actividades", { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSessionFromRequest();
  if (!session) return new NextResponse("No autenticado", { status: 401 });
  if (!hasAccess(session.roles, "crm", "standard")) {
    return new NextResponse("Sin acceso", { status: 403 });
  }

  try {
    const body = await req.json();
    const title = String(body?.title || "").trim();
    if (!title) return new NextResponse("Titulo requerido", { status: 400 });

    const payload = {
      client_id: body?.client_id || null,
      contact_id: body?.contact_id || null,
      opportunity_id: body?.opportunity_id || null,
      title,
      type: body?.type ? String(body.type).trim() : null,
      outcome: body?.outcome ? String(body.outcome).trim() : null,
      notes: body?.notes ? String(body.notes).trim() : null,
      due_at: body?.due_at || null,
      completed_at: body?.completed_at || null,
      owner: body?.owner ? String(body.owner).trim() : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from("crm_activities")
      .insert(payload)
      .select(
        "id,title,type,outcome,notes,due_at,completed_at,owner,client_id,contact_id,opportunity_id,created_at"
      )
      .maybeSingle();
    if (error) return new NextResponse("Error al crear actividad", { status: 500 });

    return NextResponse.json({ activity: data });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al crear actividad", { status: 500 });
  }
}
