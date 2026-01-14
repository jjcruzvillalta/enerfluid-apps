import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessionFromRequest, hasAccess } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest();
  if (!session) return new NextResponse("No autenticado", { status: 401 });
  if (!hasAccess(session.roles, "crm", "standard")) {
    return new NextResponse("Sin acceso", { status: 403 });
  }

  try {
    const body = await req.json();
    const updates: Record<string, any> = {};
    if (body?.title !== undefined) updates.title = String(body.title || "").trim();
    if (body?.content !== undefined) updates.content = String(body.content || "").trim();
    if (body?.client_id !== undefined) updates.client_id = body.client_id || null;
    if (body?.contact_id !== undefined) updates.contact_id = body.contact_id || null;
    if (body?.opportunity_id !== undefined) updates.opportunity_id = body.opportunity_id || null;
    if (body?.activity_id !== undefined) updates.activity_id = body.activity_id || null;
    if (body?.owner !== undefined) updates.owner = String(body.owner || "").trim();
    updates.updated_at = new Date().toISOString();

    const { error } = await supabaseServer.from("crm_notes").update(updates).eq("id", params.id);
    if (error) return new NextResponse("Error al actualizar nota", { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al actualizar nota", { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest();
  if (!session) return new NextResponse("No autenticado", { status: 401 });
  if (!hasAccess(session.roles, "crm", "standard")) {
    return new NextResponse("Sin acceso", { status: 403 });
  }

  try {
    const { error } = await supabaseServer.from("crm_notes").delete().eq("id", params.id);
    if (error) return new NextResponse("Error al eliminar nota", { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al eliminar nota", { status: 500 });
  }
}
