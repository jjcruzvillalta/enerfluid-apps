import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessionFromRequest, hasAccess } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSessionFromRequest();
  if (!session) return new NextResponse("No autenticado", { status: 401 });

  const { searchParams } = new URL(req.url);
  const appKey = String(searchParams.get("app") || "").trim();
  if (!appKey) return new NextResponse("App requerida", { status: 400 });
  if (!hasAccess(session.roles, appKey, "admin")) {
    return new NextResponse("Sin acceso", { status: 403 });
  }

  const { data: users, error: usersError } = await supabaseServer
    .from("app_users")
    .select("id,username,display_name,is_active,created_at")
    .order("display_name", { ascending: true, nullsLast: true })
    .order("username", { ascending: true });
  if (usersError) return new NextResponse("Error al cargar usuarios", { status: 500 });

  const { data: rolesRows, error: rolesError } = await supabaseServer
    .from("user_roles")
    .select("user_id,role")
    .eq("app_key", appKey);
  if (rolesError) return new NextResponse("Error al cargar roles", { status: 500 });

  const rolesMap = new Map<string, string>();
  (rolesRows || []).forEach((row) => {
    rolesMap.set(row.user_id, row.role);
  });

  const payload = (users || []).map((user) => ({
    ...user,
    role: rolesMap.get(user.id) || "none",
  }));

  return NextResponse.json({ users: payload });
}
