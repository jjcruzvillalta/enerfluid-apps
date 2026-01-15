import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessionFromRequest, hasAccess } from "@/lib/auth";

const mapRoles = (rows: any[]) => {
  const map = new Map<string, Record<string, string>>();
  rows.forEach((row) => {
    if (!map.has(row.user_id)) map.set(row.user_id, {});
    map.get(row.user_id)![row.app_key] = row.role;
  });
  return map;
};

export async function GET() {
  const session = await getSessionFromRequest();
  if (!session) return new NextResponse("No autenticado", { status: 401 });
  if (!hasAccess(session.roles, "users", "admin")) return new NextResponse("Sin acceso", { status: 403 });

  const { data: users, error } = await supabaseServer
    .from("app_users")
    .select("id,username,display_name,is_active,created_at")
    .order("display_name", { ascending: true, nullsLast: true })
    .order("username", { ascending: true });
  if (error) return new NextResponse("Error al cargar usuarios", { status: 500 });

  const { data: rolesRows } = await supabaseServer
    .from("user_roles")
    .select("user_id,app_key,role");
  const rolesMap = mapRoles(rolesRows || []);

  const payload = (users || []).map((user) => ({
    ...user,
    roles: rolesMap.get(user.id) || {},
  }));

  return NextResponse.json({ users: payload });
}

export async function POST(req: Request) {
  const session = await getSessionFromRequest();
  if (!session) return new NextResponse("No autenticado", { status: 401 });
  if (!hasAccess(session.roles, "users", "admin")) return new NextResponse("Sin acceso", { status: 403 });

  try {
    const body = await req.json();
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");
    const displayName = String(body?.displayName || "").trim();
    const roles = body?.roles || {};

    if (!username || !password) return new NextResponse("Datos incompletos", { status: 400 });
    const passwordHash = await bcrypt.hash(password, 10);

    const { data: newUser, error } = await supabaseServer
      .from("app_users")
      .insert({
        username,
        display_name: displayName || username,
        password_hash: passwordHash,
        is_active: true,
      })
      .select("id,username,display_name,is_active,created_at")
      .maybeSingle();

    if (error || !newUser) return new NextResponse("Error al crear usuario", { status: 500 });

    const roleRows = Object.entries(roles)
      .filter(([, role]) => role === "admin" || role === "standard")
      .map(([app_key, role]) => ({
        user_id: newUser.id,
        app_key,
        role,
      }));
    if (roleRows.length) {
      const { error: roleError } = await supabaseServer.from("user_roles").insert(roleRows);
      if (roleError) return new NextResponse("Error al asignar roles", { status: 500 });
    }

    return NextResponse.json({ user: newUser, roles });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error al crear usuario", { status: 500 });
  }
}
