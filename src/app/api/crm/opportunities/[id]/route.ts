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
    if (body?.client_id !== undefined) updates.client_id = body.client_id || null;
    if (body?.contact_id !== undefined) updates.contact_id = body.contact_id || null;
    if (body?.name) updates.name = String(body.name).trim();
    if (body?.stage !== undefined) updates.stage = String(body.stage || "").trim();
    if (body?.status !== undefined) updates.status = String(body.status || "").trim();
    if (body?.value !== undefined) updates.value = body.value ?? null;
    if (body?.currency !== undefined) updates.currency = String(body.currency || "").trim();
    if (body?.owner !== undefined) updates.owner = String(body.owner || "").trim();
    if (body?.expected_close_date !== undefined) updates.expected_close_date = body.expected_close_date || null;
    if (body?.close_date !== undefined) updates.close_date = body.close_date || null;
    updates.updated_at = new Date().toISOString();

    const { error } = await supabaseServer.from("crm_opportunities").update(updates).eq("id", params.id);
    if (error) return new NextResponse("Error al actualizar oportunidad", { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al actualizar oportunidad", { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest();
  if (!session) return new NextResponse("No autenticado", { status: 401 });
  if (!hasAccess(session.roles, "crm", "standard")) {
    return new NextResponse("Sin acceso", { status: 403 });
  }

  try {
    const { error } = await supabaseServer.from("crm_opportunities").delete().eq("id", params.id);
    if (error) return new NextResponse("Error al eliminar oportunidad", { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al eliminar oportunidad", { status: 500 });
  }
}
