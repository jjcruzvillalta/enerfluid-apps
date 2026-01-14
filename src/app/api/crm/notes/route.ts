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
  const clientId = String(searchParams.get("clientId") || "").trim();
  const contactId = String(searchParams.get("contactId") || "").trim();
  const opportunityId = String(searchParams.get("opportunityId") || "").trim();

  try {
    let query = supabaseServer
      .from("crm_notes")
      .select("id,title,content,client_id,contact_id,opportunity_id,activity_id,owner,created_at")
      .order("created_at", { ascending: false });

    if (clientId) query = query.eq("client_id", clientId);
    if (contactId) query = query.eq("contact_id", contactId);
    if (opportunityId) query = query.eq("opportunity_id", opportunityId);

    const { data: notes, error } = await query;
    if (error) return new NextResponse("Error al cargar notas", { status: 500 });

    return NextResponse.json({ notes: notes || [] });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al cargar notas", { status: 500 });
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
    const content = String(body?.content || "").trim();
    if (!content) return new NextResponse("Contenido requerido", { status: 400 });

    const payload = {
      title: body?.title ? String(body.title).trim() : null,
      content,
      client_id: body?.client_id || null,
      contact_id: body?.contact_id || null,
      opportunity_id: body?.opportunity_id || null,
      activity_id: body?.activity_id || null,
      owner: body?.owner ? String(body.owner).trim() : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from("crm_notes")
      .insert(payload)
      .select("id,title,content,client_id,contact_id,opportunity_id,activity_id,owner,created_at")
      .maybeSingle();
    if (error) return new NextResponse("Error al crear nota", { status: 500 });

    return NextResponse.json({ note: data });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al crear nota", { status: 500 });
  }
}
