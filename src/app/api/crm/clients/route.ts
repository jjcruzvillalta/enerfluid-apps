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
  const industry = String(searchParams.get("industry") || "").trim();
  const city = String(searchParams.get("city") || "").trim();
  const owner = String(searchParams.get("owner") || "").trim();

  try {
    let query = supabaseServer
      .from("crm_clients")
      .select("id,name,industry,city,owner,created_at,updated_at")
      .order("name", { ascending: true });

    if (q) query = query.ilike("name", `%${q}%`);
    if (industry) query = query.ilike("industry", `%${industry}%`);
    if (city) query = query.ilike("city", `%${city}%`);
    if (owner) query = query.ilike("owner", `%${owner}%`);

    const { data: clients, error } = await query;
    if (error) return new NextResponse("Error al cargar clientes", { status: 500 });

    const { data: contacts } = await supabaseServer.from("crm_contacts").select("client_id");
    const counts = new Map<string, number>();
    (contacts || []).forEach((row) => {
      if (!row.client_id) return;
      counts.set(row.client_id, (counts.get(row.client_id) || 0) + 1);
    });

    const payload = (clients || []).map((client) => ({
      ...client,
      contacts: counts.get(client.id) || 0,
    }));

    return NextResponse.json({ clients: payload });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al cargar clientes", { status: 500 });
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
      name,
      industry: body?.industry ? String(body.industry).trim() : null,
      city: body?.city ? String(body.city).trim() : null,
      owner: body?.owner ? String(body.owner).trim() : null,
      client_type: body?.client_type ? String(body.client_type).trim() : null,
      relation: body?.relation ? String(body.relation).trim() : null,
      potential: body?.potential ? String(body.potential).trim() : null,
      tags: Array.isArray(body?.tags) ? body.tags : null,
      address: body?.address ? String(body.address).trim() : null,
      state: body?.state ? String(body.state).trim() : null,
      country: body?.country ? String(body.country).trim() : null,
      postal_code: body?.postal_code ? String(body.postal_code).trim() : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from("crm_clients")
      .insert(payload)
      .select("id,name,industry,city,owner,created_at,updated_at")
      .maybeSingle();
    if (error) return new NextResponse("Error al crear cliente", { status: 500 });

    return NextResponse.json({ client: data });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al crear cliente", { status: 500 });
  }
}
