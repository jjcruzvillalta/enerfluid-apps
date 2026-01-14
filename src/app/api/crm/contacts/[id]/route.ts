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
    if (body?.name) updates.name = String(body.name).trim();
    if (body?.role !== undefined) updates.role = String(body.role || "").trim();
    if (body?.phone !== undefined) updates.phone = String(body.phone || "").trim();
    if (body?.email !== undefined) updates.email = String(body.email || "").trim();
    if (body?.area !== undefined) updates.area = String(body.area || "").trim();
    if (body?.tags !== undefined) updates.tags = Array.isArray(body.tags) ? body.tags : null;
    updates.updated_at = new Date().toISOString();

    const { error } = await supabaseServer.from("crm_contacts").update(updates).eq("id", params.id);
    if (error) return new NextResponse("Error al actualizar contacto", { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al actualizar contacto", { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest();
  if (!session) return new NextResponse("No autenticado", { status: 401 });
  if (!hasAccess(session.roles, "crm", "standard")) {
    return new NextResponse("Sin acceso", { status: 403 });
  }

  try {
    const { error } = await supabaseServer.from("crm_contacts").delete().eq("id", params.id);
    if (error) return new NextResponse("Error al eliminar contacto", { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al eliminar contacto", { status: 500 });
  }
}
