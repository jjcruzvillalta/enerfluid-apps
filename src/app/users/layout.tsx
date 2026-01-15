"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, LogOut } from "lucide-react";

export default function UsersLayout({ children }) {
  const router = useRouter();
  const { user, loading, canAccess, logout } = useAuth();
  const greeting = useMemo(() => user?.displayName || user?.username || "-", [user]);

  if (loading) return <div className="flex h-screen items-center justify-center">Cargando...</div>;
  if (!user) return <div className="flex h-screen items-center justify-center">Inicia sesion...</div>;
  if (!canAccess("users", "admin")) {
    return <div className="flex h-screen items-center justify-center">Sin acceso a Usuarios</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-cloud to-mist text-ink">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-4 py-6 md:px-8 lg:px-10">
        <Card className="glass-panel">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-500">Hola, {greeting}</p>
              <h2 className="text-xl font-semibold text-ink">Gestion de usuarios</h2>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="w-full sm:w-auto" variant="outline" onClick={() => router.push("/")}>
                <Home className="mr-2 h-4 w-4" />
                Portal
              </Button>
              <Button
                className="w-full sm:w-auto"
                variant="outline"
                onClick={async () => {
                  await logout();
                  router.push("/login");
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesion
              </Button>
            </div>
          </CardHeader>
        </Card>
        {children}
      </div>
    </div>
  );
}
