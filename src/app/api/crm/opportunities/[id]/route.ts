import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessionFromRequest, hasAccess } from "@/lib/auth";

const resolveClosedAt = async (stageId?: string | null) => {
  if (!stageId) return null;
  const { data: stage } = await supabaseServer
    .from("crm_opportunity_stages")
    .select("is_won,is_lost")
    .eq("id", stageId)
    .maybeSingle();
  if (stage?.is_won || stage?.is_lost) return new Date().toISOString();
  return null;
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest();
  if (!session) return new NextResponse("No autenticado", { status: 401 });
  if (!hasAccess(session.roles, "crm", "standard")) {
    return new NextResponse("Sin acceso", { status: 403 });
  }

  try {
    const { data: opportunity, error } = await supabaseServer
      .from("crm_opportunities")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (error || !opportunity) return new NextResponse("Oportunidad no encontrada", { status: 404 });

    const [clientRes, stageRes, responsibleRes, contactsLinks, activitiesRes, notesRes] = await Promise.all([
      opportunity.client_id
        ? supabaseServer.from("crm_clients").select("id,name,city").eq("id", opportunity.client_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      opportunity.stage_id
        ? supabaseServer.from("crm_opportunity_stages").select("id,name,is_won,is_lost").eq("id", opportunity.stage_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      opportunity.responsible_user_id
        ? supabaseServer
            .from("app_users")
            .select("id,display_name,username")
            .eq("id", opportunity.responsible_user_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabaseServer
        .from("crm_opportunity_contacts")
        .select("contact_id")
        .eq("opportunity_id", params.id),
      supabaseServer
        .from("crm_activities")
        .select("id,activity_type_id,outcome_id,responsible_user_id,scheduled_at,detail,created_at")
        .eq("opportunity_id", params.id)
        .order("scheduled_at", { ascending: false }),
      supabaseServer
        .from("crm_notes")
        .select("id,detail,author_user_id,parent_note_id,created_at")
        .eq("opportunity_id", params.id)
        .order("created_at", { ascending: true }),
    ]);

    if (
      clientRes.error ||
      stageRes.error ||
      responsibleRes.error ||
      contactsLinks.error ||
      activitiesRes.error ||
      notesRes.error
    ) {
      return new NextResponse("Error al cargar detalle", { status: 500 });
    }

    const contactIds = Array.from(new Set((contactsLinks.data || []).map((row) => row.contact_id)));
    const contactsRes = contactIds.length
      ? await supabaseServer
          .from("crm_contacts")
          .select("id,name,role,phone,email")
          .in("id", contactIds)
      : { data: [] };

    const typeIds = Array.from(new Set((activitiesRes.data || []).map((row) => row.activity_type_id).filter(Boolean)));
    const outcomeIds = Array.from(new Set((activitiesRes.data || []).map((row) => row.outcome_id).filter(Boolean)));
    const userIds = Array.from(
      new Set(
        [
          ...((activitiesRes.data || []).map((row) => row.responsible_user_id) || []),
          ...((notesRes.data || []).map((row) => row.author_user_id) || []),
        ].filter(Boolean)
      )
    );

    const [typeRows, outcomeRows, userRows] = await Promise.all([
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

    const typeMap = new Map((typeRows.data || []).map((row) => [row.id, row.name]));
    const outcomeMap = new Map((outcomeRows.data || []).map((row) => [row.id, row.name]));
    const userMap = new Map(
      (userRows.data || []).map((row) => [row.id, row.display_name || row.username])
    );

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
      opportunity,
      client: clientRes.data || null,
      stage: stageRes.data || null,
      responsible: responsibleRes.data
        ? { id: responsibleRes.data.id, name: responsibleRes.data.display_name || responsibleRes.data.username }
        : null,
      contacts: contactsRes.data || [],
      activities,
      notes,
    });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al cargar oportunidad", { status: 500 });
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
    if (body?.title !== undefined) updates.title = String(body.title || "").trim();
    if (body?.client_id !== undefined) updates.client_id = body.client_id || null;
    if (body?.responsible_user_id !== undefined) updates.responsible_user_id = body.responsible_user_id || null;
    if (body?.stage_id !== undefined) {
      updates.stage_id = body.stage_id || null;
      updates.closed_at = await resolveClosedAt(body.stage_id);
    }
    updates.updated_at = new Date().toISOString();

    const { error } = await supabaseServer.from("crm_opportunities").update(updates).eq("id", params.id);
    if (error) return new NextResponse("Error al actualizar oportunidad", { status: 500 });

    if (Array.isArray(body?.contact_ids)) {
      await supabaseServer.from("crm_opportunity_contacts").delete().eq("opportunity_id", params.id);
      const contactIds = body.contact_ids.filter(Boolean);
      if (contactIds.length) {
        const rows = contactIds.map((contactId: string) => ({
          opportunity_id: params.id,
          contact_id: contactId,
        }));
        await supabaseServer.from("crm_opportunity_contacts").insert(rows);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al actualizar oportunidad", { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest();
  if (!session) return new NextResponse("No autenticado", { status: 401 });
  if (!hasAccess(session.roles, "crm", "admin")) {
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
