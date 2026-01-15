import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessionFromRequest, hasAccess } from "@/lib/auth";

const uniqueIds = (values: any[]) => Array.from(new Set(values.filter(Boolean)));

const parseNumber = (value: any) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

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

const resolveNextSortOrder = async (stageId?: string | null) => {
  let query = supabaseServer
    .from("crm_opportunities")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  if (stageId) query = query.eq("stage_id", stageId);
  else query = query.is("stage_id", null);
  const { data } = await query;
  const max = data?.[0]?.sort_order;
  if (Number.isFinite(max)) return Number(max) + 1;
  return Date.now();
};

export async function GET(req: Request) {
  const session = await getSessionFromRequest();
  if (!session) return new NextResponse("No autenticado", { status: 401 });
  if (!hasAccess(session.roles, "crm", "standard")) {
    return new NextResponse("Sin acceso", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") || "").trim();
  const stageId = String(searchParams.get("stageId") || "").trim();
  const clientId = String(searchParams.get("clientId") || "").trim();
  const responsibleId = String(searchParams.get("responsibleId") || "").trim();

  try {
    let query = supabaseServer
      .from("crm_opportunities")
      .select("id,title,client_id,responsible_user_id,stage_id,closed_at,created_at,value,sort_order")
      .order("created_at", { ascending: false });

    if (q) query = query.ilike("title", `%${q}%`);
    if (stageId === "sin_etapa") {
      query = query.is("stage_id", null);
    } else if (stageId) {
      query = query.eq("stage_id", stageId);
    }
    if (clientId) query = query.eq("client_id", clientId);
    if (responsibleId) query = query.eq("responsible_user_id", responsibleId);

    const { data: opportunities, error } = await query;
    if (error) return new NextResponse("Error al cargar oportunidades", { status: 500 });

    const clientIds = uniqueIds((opportunities || []).map((row) => row.client_id));
    const stageIds = uniqueIds((opportunities || []).map((row) => row.stage_id));
    const userIds = uniqueIds((opportunities || []).map((row) => row.responsible_user_id));

    const [clientsRes, stagesRes, usersRes] = await Promise.all([
      clientIds.length
        ? supabaseServer.from("crm_clients").select("id,name").in("id", clientIds)
        : Promise.resolve({ data: [] }),
      stageIds.length
        ? supabaseServer.from("crm_opportunity_stages").select("id,name").in("id", stageIds)
        : Promise.resolve({ data: [] }),
      userIds.length
        ? supabaseServer.from("app_users").select("id,display_name,username").in("id", userIds)
        : Promise.resolve({ data: [] }),
    ]);

    const clientMap = new Map((clientsRes.data || []).map((row) => [row.id, row.name]));
    const stageMap = new Map((stagesRes.data || []).map((row) => [row.id, row.name]));
    const userMap = new Map(
      (usersRes.data || []).map((row) => [row.id, row.display_name || row.username])
    );

    const contactCounts = new Map<string, number>();
    const oppIds = (opportunities || []).map((row) => row.id);
    if (oppIds.length) {
      const { data: links } = await supabaseServer
        .from("crm_opportunity_contacts")
        .select("opportunity_id")
        .in("opportunity_id", oppIds);
      (links || []).forEach((row) => {
        contactCounts.set(row.opportunity_id, (contactCounts.get(row.opportunity_id) || 0) + 1);
      });
    }

    const payload = (opportunities || []).map((row) => ({
      ...row,
      value: parseNumber(row.value),
      sort_order: parseNumber(row.sort_order),
      client_name: row.client_id ? clientMap.get(row.client_id) || "-" : "-",
      stage_name: row.stage_id ? stageMap.get(row.stage_id) || "-" : "-",
      responsible_name: row.responsible_user_id ? userMap.get(row.responsible_user_id) || "-" : "-",
      contacts_count: contactCounts.get(row.id) || 0,
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
    const title = String(body?.title || "").trim();
    if (!title) return new NextResponse("Titulo requerido", { status: 400 });

    const stageId = body?.stage_id || null;
    const closedAt = await resolveClosedAt(stageId);
    const value = parseNumber(body?.value);
    const sortOrder =
      Number.isFinite(Number(body?.sort_order)) ? Number(body.sort_order) : await resolveNextSortOrder(stageId);

    const payload = {
      title,
      client_id: body?.client_id || null,
      responsible_user_id: body?.responsible_user_id || null,
      stage_id: stageId,
      closed_at: closedAt,
      value,
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
    };

    const { data: opportunity, error } = await supabaseServer
      .from("crm_opportunities")
      .insert(payload)
      .select("id,title,client_id,responsible_user_id,stage_id,closed_at,created_at,value,sort_order")
      .maybeSingle();
    if (error || !opportunity) return new NextResponse("Error al crear oportunidad", { status: 500 });

    const contactIds = Array.isArray(body?.contact_ids) ? body.contact_ids.filter(Boolean) : [];
    if (contactIds.length) {
      const rows = contactIds.map((contactId: string) => ({
        opportunity_id: opportunity.id,
        contact_id: contactId,
      }));
      await supabaseServer.from("crm_opportunity_contacts").insert(rows);
    }

    return NextResponse.json({ opportunity });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al crear oportunidad", { status: 500 });
  }
}
