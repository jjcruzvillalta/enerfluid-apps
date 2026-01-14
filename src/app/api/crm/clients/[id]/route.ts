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
    if (body?.name) updates.name = String(body.name).trim();
    if (body?.industry !== undefined) updates.industry = String(body.industry || "").trim();
    if (body?.city !== undefined) updates.city = String(body.city || "").trim();
    if (body?.owner !== undefined) updates.owner = String(body.owner || "").trim();
    if (body?.client_type !== undefined) updates.client_type = String(body.client_type || "").trim();
    if (body?.relation !== undefined) updates.relation = String(body.relation || "").trim();
    if (body?.potential !== undefined) updates.potential = String(body.potential || "").trim();
    if (body?.tags !== undefined) updates.tags = Array.isArray(body.tags) ? body.tags : null;
    if (body?.address !== undefined) updates.address = String(body.address || "").trim();
    if (body?.state !== undefined) updates.state = String(body.state || "").trim();
    if (body?.country !== undefined) updates.country = String(body.country || "").trim();
    if (body?.postal_code !== undefined) updates.postal_code = String(body.postal_code || "").trim();

    updates.updated_at = new Date().toISOString();

    const { error } = await supabaseServer.from("crm_clients").update(updates).eq("id", params.id);
    if (error) return new NextResponse("Error al actualizar cliente", { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al actualizar cliente", { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest();
  if (!session) return new NextResponse("No autenticado", { status: 401 });
  if (!hasAccess(session.roles, "crm", "standard")) {
    return new NextResponse("Sin acceso", { status: 403 });
  }

  try {
    const { error } = await supabaseServer.from("crm_clients").delete().eq("id", params.id);
    if (error) return new NextResponse("Error al eliminar cliente", { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al eliminar cliente", { status: 500 });
  }
}
