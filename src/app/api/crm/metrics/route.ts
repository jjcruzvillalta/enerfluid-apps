import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessionFromRequest, hasAccess } from "@/lib/auth";

const isClosedStage = (value: string) => {
  const key = value.toLowerCase();
  return (
    key.includes("ganad") ||
    key.includes("perdid") ||
    key === "won" ||
    key === "lost" ||
    key === "closed"
  );
};

const normalizeStatus = (value: string) => value.toLowerCase().trim();

const getWeekStart = (value: Date) => {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 1 - day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const formatWeekKey = (date: Date) => {
  const start = getWeekStart(date);
  const year = start.getUTCFullYear();
  const month = String(start.getUTCMonth() + 1).padStart(2, "0");
  const day = String(start.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export async function GET(req: Request) {
  const session = await getSessionFromRequest();
  if (!session) return new NextResponse("No autenticado", { status: 401 });
  if (!hasAccess(session.roles, "crm", "standard")) {
    return new NextResponse("Sin acceso", { status: 403 });
  }

  try {
    const [clientsCountRes, contactsCountRes, opportunitiesRes, activitiesRes] = await Promise.all([
      supabaseServer.from("crm_clients").select("id", { count: "exact", head: true }),
      supabaseServer.from("crm_contacts").select("id", { count: "exact", head: true }),
      supabaseServer
        .from("crm_opportunities")
        .select("id,stage,status,value,weighted_value,currency,updated_at,created_at"),
      supabaseServer
        .from("crm_activities")
        .select("id,title,due_at,completed_at,created_at,owner,client_id,opportunity_id,contact_id"),
    ]);

    if (clientsCountRes.error || contactsCountRes.error) {
      return new NextResponse("Error al cargar conteos", { status: 500 });
    }
    if (opportunitiesRes.error || activitiesRes.error) {
      return new NextResponse("Error al cargar datos CRM", { status: 500 });
    }

    const opportunities = opportunitiesRes.data || [];
    const activities = activitiesRes.data || [];

    const pipelineMap = new Map<string, { stage: string; count: number; value: number }>();
    let openDeals = 0;
    let pipelineValue = 0;

    opportunities.forEach((row) => {
      const stage = row.stage || "Sin etapa";
      const status = normalizeStatus(row.status || "");
      const closed = status ? isClosedStage(status) : isClosedStage(stage);
      const value = Number(row.value || 0);
      if (!closed) {
        openDeals += 1;
        pipelineValue += Number.isFinite(value) ? value : 0;
      }
      if (!pipelineMap.has(stage)) {
        pipelineMap.set(stage, { stage, count: 0, value: 0 });
      }
      const entry = pipelineMap.get(stage)!;
      entry.count += 1;
      entry.value += Number.isFinite(value) ? value : 0;
    });

    const pipelineStages = Array.from(pipelineMap.values()).sort((a, b) => b.value - a.value);

    const now = new Date();
    const todayKey = formatWeekKey(now);
    const activitiesByWeekMap = new Map<string, number>();
    let activitiesToday = 0;
    const recentActivities = activities
      .slice()
      .sort((a, b) => {
        const dateA = new Date(a.due_at || a.created_at || 0).getTime();
        const dateB = new Date(b.due_at || b.created_at || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 6);

    activities.forEach((row) => {
      const dateValue = row.due_at || row.created_at;
      if (!dateValue) return;
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return;
      const key = formatWeekKey(date);
      activitiesByWeekMap.set(key, (activitiesByWeekMap.get(key) || 0) + 1);
      if (key === todayKey) activitiesToday += 1;
    });

    const weeks = [];
    const current = getWeekStart(now);
    for (let i = 11; i >= 0; i -= 1) {
      const date = new Date(current);
      date.setUTCDate(current.getUTCDate() - i * 7);
      weeks.push({ key: formatWeekKey(date), label: date.toISOString().slice(0, 10) });
    }
    const activitiesByWeek = weeks.map((week) => ({
      week: week.label,
      count: activitiesByWeekMap.get(week.key) || 0,
    }));

    const clientsMap = new Map<string, string>();
    const clientIds = Array.from(
      new Set(recentActivities.map((row) => row.client_id).filter(Boolean))
    );
    if (clientIds.length) {
      const { data: clientRows } = await supabaseServer
        .from("crm_clients")
        .select("id,name")
        .in("id", clientIds);
      (clientRows || []).forEach((client) => clientsMap.set(client.id, client.name));
    }

    const activitiesWithNames = recentActivities.map((row) => ({
      ...row,
      client_name: row.client_id ? clientsMap.get(row.client_id) || "-" : "-",
    }));

    return NextResponse.json({
      counts: {
        clients: clientsCountRes.count || 0,
        contacts: contactsCountRes.count || 0,
        openDeals,
        activitiesToday,
        pipelineValue,
      },
      pipelineStages,
      activitiesByWeek,
      recentActivities: activitiesWithNames,
    });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al cargar metricas", { status: 500 });
  }
}
