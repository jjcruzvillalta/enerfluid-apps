import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessionFromRequest, hasAccess } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSessionFromRequest();
  if (!session) return new NextResponse("No autenticado", { status: 401 });
  if (!hasAccess(session.roles, "crm", "standard")) {
    return new NextResponse("Sin acceso", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") || "").trim();
  const stage = String(searchParams.get("stage") || "").trim();
  const status = String(searchParams.get("status") || "").trim();
  const clientId = String(searchParams.get("clientId") || "").trim();

  try {
    let query = supabaseServer
      .from("crm_opportunities")
      .select(
        "id,name,stage,status,value,currency,client_id,contact_id,owner,expected_close_date,close_date,updated_at,created_at"
      )
      .order("updated_at", { ascending: false });

    if (q) query = query.ilike("name", `%${q}%`);
    if (stage) query = query.eq("stage", stage);
    if (status) query = query.eq("status", status);
    if (clientId) query = query.eq("client_id", clientId);

    const { data: deals, error } = await query;
    if (error) return new NextResponse("Error al cargar oportunidades", { status: 500 });

    const clientIds = Array.from(new Set((deals || []).map((row) => row.client_id).filter(Boolean)));
    const contactIds = Array.from(new Set((deals || []).map((row) => row.contact_id).filter(Boolean)));

    const clientMap = new Map<string, string>();
    if (clientIds.length) {
      const { data: clientRows } = await supabaseServer
        .from("crm_clients")
        .select("id,name")
        .in("id", clientIds);
      (clientRows || []).forEach((client) => clientMap.set(client.id, client.name));
    }

    const contactMap = new Map<string, string>();
    if (contactIds.length) {
      const { data: contactRows } = await supabaseServer
        .from("crm_contacts")
        .select("id,name")
        .in("id", contactIds);
      (contactRows || []).forEach((contact) => contactMap.set(contact.id, contact.name));
    }

    const payload = (deals || []).map((row) => ({
      ...row,
      client_name: row.client_id ? clientMap.get(row.client_id) || "-" : "-",
      contact_name: row.contact_id ? contactMap.get(row.contact_id) || "-" : "-",
    }));

    return NextResponse.json({ opportunities: payload });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al cargar oportunidades", { status: 500 });
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
    const name = String(body?.name || "").trim();
    if (!name) return new NextResponse("Nombre requerido", { status: 400 });

    const payload = {
      client_id: body?.client_id || null,
      contact_id: body?.contact_id || null,
      name,
      stage: body?.stage ? String(body.stage).trim() : null,
      status: body?.status ? String(body.status).trim() : null,
      value: body?.value ?? null,
      currency: body?.currency ? String(body.currency).trim() : null,
      owner: body?.owner ? String(body.owner).trim() : null,
      expected_close_date: body?.expected_close_date || null,
      close_date: body?.close_date || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from("crm_opportunities")
      .insert(payload)
      .select(
        "id,name,stage,status,value,currency,client_id,contact_id,owner,expected_close_date,close_date,updated_at,created_at"
      )
      .maybeSingle();
    if (error) return new NextResponse("Error al crear oportunidad", { status: 500 });

    return NextResponse.json({ opportunity: data });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al crear oportunidad", { status: 500 });
  }
}
