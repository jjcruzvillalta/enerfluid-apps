"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const apps = [
  { key: "inventory", title: "Inventario", description: "Carga, analisis y reposicion.", href: "/inventory" },
  { key: "crm", title: "CRM", description: "Clientes, contactos y oportunidades.", href: "/crm" },
  { key: "users", title: "Usuarios", description: "Gestion centralizada de accesos.", href: "/users" },
];

export default function PortalPage() {
  const router = useRouter();
  const { user, loading, canAccess, logout } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Cargando...</div>;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cloud">
        <Card className="p-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-800">Enerfluid Apps</h1>
          <p className="mt-2 text-sm text-slate-500">Inicia sesion para acceder al portal.</p>
          <Button className="mt-4" asChild>
            <Link href="/login">Ir a login</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-cloud to-mist px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-500">Bienvenido, {user.displayName || user.username}</p>
            <h1 className="text-3xl font-semibold text-slate-900">Enerfluid Apps</h1>
            <p className="text-sm text-slate-500">Portal de acceso a todas las aplicaciones.</p>
          </div>
          <Button variant="outline" className="self-start" onClick={handleLogout}>
            Cerrar sesion
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {apps.map((app) => {
            const enabled = canAccess(app.key, "standard");
            return (
              <Card key={app.key} className="flex flex-col justify-between p-6 shadow-soft">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">{app.title}</h2>
                  <p className="mt-2 text-sm text-slate-500">{app.description}</p>
                </div>
                {enabled ? (
                  <Button className="mt-6" asChild>
                    <Link href={app.href}>Abrir</Link>
                  </Button>
                ) : (
                  <Button className="mt-6" variant="outline" disabled>
                    Sin acceso
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}
