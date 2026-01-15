"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";

type RoleRow = {
  id: string;
  username: string;
  display_name?: string | null;
  is_active?: boolean | null;
  role: string;
};

export default function InventorySettingsPage() {
  const { user, loading, canAccess } = useAuth();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  useEffect(() => {
    if (!user || !canAccess("inventory", "admin")) return;
    const load = async () => {
      setRolesLoading(true);
      try {
        const res = await fetch("/api/roles?app=inventory", { cache: "no-store", credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const sorted = (data?.users || []).slice().sort((a: RoleRow, b: RoleRow) => {
          const aName = (a.display_name || a.username || "").toLowerCase();
          const bName = (b.display_name || b.username || "").toLowerCase();
          return aName.localeCompare(bName);
        });
        setRoles(sorted);
      } finally {
        setRolesLoading(false);
      }
    };
    load();
  }, [user, canAccess]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Configuracion Inventario</h1>
        <p className="text-sm text-slate-500">Accesos y parametros del modulo de inventario.</p>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Accesos a Inventario</h2>
          <span className="text-xs text-slate-400">
            {rolesLoading ? "Cargando..." : `${roles.length} usuarios`}
          </span>
        </div>
        {!loading && !canAccess("inventory", "admin") ? (
          <p className="mt-3 text-sm text-slate-400">Solo admin Inventario puede ver los accesos.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500 bg-mist">
                <tr>
                  <th className="px-3 py-2 text-left">Nombre</th>
                  <th className="px-3 py-2 text-left">Usuario</th>
                  <th className="px-3 py-2 text-left">Rol</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">{row.display_name || "-"}</td>
                    <td className="px-3 py-2">{row.username}</td>
                    <td className="px-3 py-2">{row.role || "none"}</td>
                    <td className="px-3 py-2">{row.is_active === false ? "Inactivo" : "Activo"}</td>
                  </tr>
                ))}
                {!roles.length && !rolesLoading && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-400">
                      Sin usuarios.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
