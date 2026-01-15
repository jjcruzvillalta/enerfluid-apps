"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

type RoleRow = {
  id: string;
  username: string;
  display_name?: string | null;
  is_active?: boolean | null;
  role: string;
};

type ConfigItem = {
  id: string;
  name: string;
  is_active?: boolean | null;
  is_effective?: boolean | null;
  is_won?: boolean | null;
  is_lost?: boolean | null;
  sort_order?: number | null;
};

type ConfigState = {
  items: ConfigItem[];
  newName: string;
};

const emptyConfig = { items: [], newName: "" };

export default function CrmSettingsPage() {
  const { user, loading, canAccess } = useAuth();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [clientTypes, setClientTypes] = useState<ConfigState>(emptyConfig);
  const [activityTypes, setActivityTypes] = useState<ConfigState>(emptyConfig);
  const [activityOutcomes, setActivityOutcomes] = useState<ConfigState>(emptyConfig);
  const [opportunityStages, setOpportunityStages] = useState<ConfigState>(emptyConfig);

  const isAdmin = canAccess("crm", "admin");

  const loadConfig = async () => {
    const [typesRes, activityTypesRes, outcomesRes, stagesRes] = await Promise.all([
      fetch("/api/crm/config?kind=client-types", { cache: "no-store", credentials: "include" }),
      fetch("/api/crm/config?kind=activity-types", { cache: "no-store", credentials: "include" }),
      fetch("/api/crm/config?kind=activity-outcomes", { cache: "no-store", credentials: "include" }),
      fetch("/api/crm/config?kind=opportunity-stages", { cache: "no-store", credentials: "include" }),
    ]);

    if (typesRes.ok) {
      const data = await typesRes.json();
      setClientTypes((prev) => ({ ...prev, items: data?.items || [] }));
    }
    if (activityTypesRes.ok) {
      const data = await activityTypesRes.json();
      setActivityTypes((prev) => ({ ...prev, items: data?.items || [] }));
    }
    if (outcomesRes.ok) {
      const data = await outcomesRes.json();
      setActivityOutcomes((prev) => ({ ...prev, items: data?.items || [] }));
    }
    if (stagesRes.ok) {
      const data = await stagesRes.json();
      setOpportunityStages((prev) => ({ ...prev, items: data?.items || [] }));
    }
  };

  useEffect(() => {
    if (!user || !canAccess("crm", "standard")) return;
    loadConfig();
  }, [user, canAccess]);

  useEffect(() => {
    if (!user || !canAccess("crm", "admin")) return;
    const loadRoles = async () => {
      setRolesLoading(true);
      try {
        const res = await fetch("/api/roles?app=crm", { cache: "no-store", credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setRoles(data?.users || []);
      } finally {
        setRolesLoading(false);
      }
    };
    loadRoles();
  }, [user, canAccess]);

  const addConfigItem = async (kind: string, state: ConfigState, setState: (value: ConfigState) => void) => {
    if (!state.newName.trim()) return;
    const res = await fetch(`/api/crm/config?kind=${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: state.newName.trim() }),
    });
    if (!res.ok) return;
    setState({ ...state, newName: "" });
    await loadConfig();
  };

  const updateConfigItem = async (kind: string, id: string, updates: Record<string, any>) => {
    await fetch(`/api/crm/config?kind=${kind}&id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(updates),
    });
    await loadConfig();
  };

  const deleteConfigItem = async (kind: string, id: string) => {
    await fetch(`/api/crm/config?kind=${kind}&id=${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await loadConfig();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Configuracion CRM</h1>
        <p className="text-sm text-slate-500">Administra opciones y catalogos del CRM.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Tipos de cliente</h2>
            <span className="text-xs text-slate-400">{clientTypes.items.length}</span>
          </div>
          {isAdmin ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Nuevo tipo"
                value={clientTypes.newName}
                onChange={(event) => setClientTypes((prev) => ({ ...prev, newName: event.target.value }))}
              />
              <Button className="w-full sm:w-auto" onClick={() => addConfigItem("client-types", clientTypes, setClientTypes)}>
                Agregar
              </Button>
            </div>
          ) : null}
          <div className="space-y-2">
            {clientTypes.items.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-line px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-slate-700">{item.name}</span>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.is_active !== false}
                      disabled={!isAdmin}
                      onChange={(event) => updateConfigItem("client-types", item.id, { is_active: event.target.checked })}
                    />
                    Activo
                  </label>
                  {isAdmin ? (
                    <button className="text-rose-500" onClick={() => deleteConfigItem("client-types", item.id)}>
                      Eliminar
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Tipos de actividad</h2>
            <span className="text-xs text-slate-400">{activityTypes.items.length}</span>
          </div>
          {isAdmin ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Nuevo tipo"
                value={activityTypes.newName}
                onChange={(event) => setActivityTypes((prev) => ({ ...prev, newName: event.target.value }))}
              />
              <Button className="w-full sm:w-auto" onClick={() => addConfigItem("activity-types", activityTypes, setActivityTypes)}>
                Agregar
              </Button>
            </div>
          ) : null}
          <div className="space-y-2">
            {activityTypes.items.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-line px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-slate-700">{item.name}</span>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.is_active !== false}
                      disabled={!isAdmin}
                      onChange={(event) => updateConfigItem("activity-types", item.id, { is_active: event.target.checked })}
                    />
                    Activo
                  </label>
                  {isAdmin ? (
                    <button className="text-rose-500" onClick={() => deleteConfigItem("activity-types", item.id)}>
                      Eliminar
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Resultados de actividad</h2>
            <span className="text-xs text-slate-400">{activityOutcomes.items.length}</span>
          </div>
          {isAdmin ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Nuevo resultado"
                value={activityOutcomes.newName}
                onChange={(event) => setActivityOutcomes((prev) => ({ ...prev, newName: event.target.value }))}
              />
              <Button
                className="w-full sm:w-auto"
                onClick={() => addConfigItem("activity-outcomes", activityOutcomes, setActivityOutcomes)}
              >
                Agregar
              </Button>
            </div>
          ) : null}
          <div className="space-y-2">
            {activityOutcomes.items.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-line px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-slate-700">{item.name}</span>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.is_effective === true}
                      disabled={!isAdmin}
                      onChange={(event) => updateConfigItem("activity-outcomes", item.id, { is_effective: event.target.checked })}
                    />
                    Efectivo
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.is_active !== false}
                      disabled={!isAdmin}
                      onChange={(event) => updateConfigItem("activity-outcomes", item.id, { is_active: event.target.checked })}
                    />
                    Activo
                  </label>
                  {isAdmin ? (
                    <button className="text-rose-500" onClick={() => deleteConfigItem("activity-outcomes", item.id)}>
                      Eliminar
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Etapas de oportunidad</h2>
            <span className="text-xs text-slate-400">{opportunityStages.items.length}</span>
          </div>
          {isAdmin ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Nueva etapa"
                value={opportunityStages.newName}
                onChange={(event) => setOpportunityStages((prev) => ({ ...prev, newName: event.target.value }))}
              />
              <Button
                className="w-full sm:w-auto"
                onClick={() => addConfigItem("opportunity-stages", opportunityStages, setOpportunityStages)}
              >
                Agregar
              </Button>
            </div>
          ) : null}
          <div className="space-y-2">
            {opportunityStages.items.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-line px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-slate-700">{item.name}</span>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.is_won === true}
                      disabled={!isAdmin}
                      onChange={(event) => updateConfigItem("opportunity-stages", item.id, { is_won: event.target.checked })}
                    />
                    Ganado
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.is_lost === true}
                      disabled={!isAdmin}
                      onChange={(event) => updateConfigItem("opportunity-stages", item.id, { is_lost: event.target.checked })}
                    />
                    Perdido
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.is_active !== false}
                      disabled={!isAdmin}
                      onChange={(event) => updateConfigItem("opportunity-stages", item.id, { is_active: event.target.checked })}
                    />
                    Activo
                  </label>
                  {isAdmin ? (
                    <button className="text-rose-500" onClick={() => deleteConfigItem("opportunity-stages", item.id)}>
                      Eliminar
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Accesos al CRM</h2>
          <span className="text-xs text-slate-400">{rolesLoading ? "Cargando..." : `${roles.length} usuarios`}</span>
        </div>
        {!loading && !canAccess("crm", "admin") ? (
          <p className="mt-3 text-sm text-slate-400">Solo admin CRM puede ver los accesos.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-mist text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Usuario</th>
                  <th className="px-3 py-2 text-left">Nombre</th>
                  <th className="px-3 py-2 text-left">Rol</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">{row.username}</td>
                    <td className="px-3 py-2">{row.display_name || "-"}</td>
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
