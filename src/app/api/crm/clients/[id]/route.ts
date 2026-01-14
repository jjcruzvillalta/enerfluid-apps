import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessionFromRequest, hasAccess } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest();
  if (!session) return new NextResponse("No autenticado", { status: 401 });
  if (!hasAccess(session.roles, "crm", "standard")) {
    return new NextResponse("Sin acceso", { status: 403 });
  }

  try {
    const { data: client, error } = await supabaseServer
      .from("crm_clients")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (error || !client) return new NextResponse("Cliente no encontrado", { status: 404 });

    const [typeRes, responsibleRes, contactsRes, opportunitiesRes, activitiesRes, notesRes] = await Promise.all([
      client.client_type_id
        ? supabaseServer.from("crm_client_types").select("id,name").eq("id", client.client_type_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      client.responsible_user_id
        ? supabaseServer
            .from("app_users")
            .select("id,display_name,username")
            .eq("id", client.responsible_user_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabaseServer
        .from("crm_contacts")
        .select("id,name,role,phone,email,detail,created_at")
        .eq("client_id", params.id)
        .order("created_at", { ascending: false }),
      supabaseServer
        .from("crm_opportunities")
        .select("id,title,stage_id,responsible_user_id,created_at")
        .eq("client_id", params.id)
        .order("created_at", { ascending: false }),
      supabaseServer
        .from("crm_activities")
        .select("id,activity_type_id,outcome_id,responsible_user_id,scheduled_at,detail,created_at")
        .eq("client_id", params.id)
        .order("scheduled_at", { ascending: false }),
      supabaseServer
        .from("crm_notes")
        .select("id,detail,author_user_id,parent_note_id,created_at")
        .eq("client_id", params.id)
        .order("created_at", { ascending: true }),
    ]);

    if (
      typeRes.error ||
      responsibleRes.error ||
      contactsRes.error ||
      opportunitiesRes.error ||
      activitiesRes.error ||
      notesRes.error
    ) {
      return new NextResponse("Error al cargar detalle", { status: 500 });
    }

    const stageIds = Array.from(new Set((opportunitiesRes.data || []).map((row) => row.stage_id).filter(Boolean)));
    const typeIds = Array.from(new Set((activitiesRes.data || []).map((row) => row.activity_type_id).filter(Boolean)));
    const outcomeIds = Array.from(new Set((activitiesRes.data || []).map((row) => row.outcome_id).filter(Boolean)));
    const userIds = Array.from(
      new Set(
        [
          ...((opportunitiesRes.data || []).map((row) => row.responsible_user_id) || []),
          ...((activitiesRes.data || []).map((row) => row.responsible_user_id) || []),
          ...((notesRes.data || []).map((row) => row.author_user_id) || []),
        ].filter(Boolean)
      )
    );

    const [stageRows, typeRows, outcomeRows, userRows] = await Promise.all([
      stageIds.length
        ? supabaseServer.from("crm_opportunity_stages").select("id,name").in("id", stageIds)
        : Promise.resolve({ data: [] }),
      typeIds.length
        ? supabaseServer.from("crm_activity_types").select("id,name").in("id", typeIds)
        : Promise.resolve({ data: [] }),
      outcomeIds.length
        ? supabaseServer.from("crm_activity_outcomes").select("id,name").in("id", outcomeIds)
        : Promise.resolve({ data: [] }),
      userIds.length
        ? supabaseServer.from("app_users").select("id,display_name,username").in("id", userIds)
        : Promise.resolve({ data: [] }),
    ]);

    const stageMap = new Map((stageRows.data || []).map((row) => [row.id, row.name]));
    const typeMap = new Map((typeRows.data || []).map((row) => [row.id, row.name]));
    const outcomeMap = new Map((outcomeRows.data || []).map((row) => [row.id, row.name]));
    const userMap = new Map(
      (userRows.data || []).map((row) => [row.id, row.display_name || row.username])
    );

    const opportunities = (opportunitiesRes.data || []).map((row) => ({
      ...row,
      stage_name: row.stage_id ? stageMap.get(row.stage_id) || "-" : "-",
      responsible_name: row.responsible_user_id ? userMap.get(row.responsible_user_id) || "-" : "-",
    }));

    const activities = (activitiesRes.data || []).map((row) => ({
      ...row,
      type_name: row.activity_type_id ? typeMap.get(row.activity_type_id) || "-" : "-",
      outcome_name: row.outcome_id ? outcomeMap.get(row.outcome_id) || "-" : "-",
      responsible_name: row.responsible_user_id ? userMap.get(row.responsible_user_id) || "-" : "-",
    }));

    const notes = (notesRes.data || []).map((row) => ({
      ...row,
      author_name: row.author_user_id ? userMap.get(row.author_user_id) || "-" : "-",
    }));

    return NextResponse.json({
      client,
      client_type: typeRes.data || null,
      responsible: responsibleRes.data
        ? {
            id: responsibleRes.data.id,
            name: responsibleRes.data.display_name || responsibleRes.data.username,
          }
        : null,
      contacts: contactsRes.data || [],
      opportunities,
      activities,
      notes,
    });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al cargar cliente", { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest();
  if (!session) return new NextResponse("No autenticado", { status: 401 });
  if (!hasAccess(session.roles, "crm", "standard")) {
    return new NextResponse("Sin acceso", { status: 403 });
  }

  try {
    const body = await req.json();
    const updates: Record<string, any> = {};
    if (body?.name !== undefined) updates.name = String(body.name || "").trim();
    if (body?.client_type_id !== undefined) updates.client_type_id = body.client_type_id || null;
    if (body?.city !== undefined) updates.city = String(body.city || "").trim();
    if (body?.detail !== undefined) updates.detail = String(body.detail || "").trim();
    if (body?.responsible_user_id !== undefined) updates.responsible_user_id = body.responsible_user_id || null;
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
  if (!hasAccess(session.roles, "crm", "admin")) {
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
