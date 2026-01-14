"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCrmDialogs } from "@/components/crm/useCrmDialogs";
import { formatDateTime } from "@/lib/data";

type OpportunityRow = {
  id: string;
  title: string;
  stage_id?: string | null;
  stage_name?: string | null;
  client_name?: string | null;
  responsible_name?: string | null;
  contacts_count?: number;
  created_at?: string | null;
};

type StageOption = { id: string; name: string };

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const { openOpportunity, createOpportunity, dialogs } = useCrmDialogs({
    onRefresh: () => setRefreshToken((prev) => prev + 1),
  });

  useEffect(() => {
    const loadConfig = async () => {
      const res = await fetch("/api/crm/config?kind=opportunity-stages", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setStages(data?.items || []);
    };
    loadConfig();
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/crm/opportunities", { cache: "no-store", credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setOpportunities(data?.opportunities || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshToken]);

  const stageOrder = useMemo(() => stages.map((stage) => stage.id), [stages]);

  const grouped = useMemo(() => {
    const map = new Map<string, OpportunityRow[]>();
    stages.forEach((stage) => map.set(stage.id, []));
    map.set("sin_etapa", []);
    opportunities.forEach((row) => {
      const stageId = row.stage_id || "sin_etapa";
      if (!map.has(stageId)) map.set(stageId, []);
      map.get(stageId)!.push(row);
    });
    return map;
  }, [opportunities, stages]);

  const stageList = useMemo(() => {
    const list = stageOrder.map((id) => ({ id, name: stages.find((stage) => stage.id === id)?.name || "" }));
    list.push({ id: "sin_etapa", name: "Sin etapa" });
    return list;
  }, [stageOrder, stages]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Oportunidades</h1>
          <p className="text-sm text-slate-500">Pipeline comercial por etapa.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-line bg-white p-1">
            <button
              type="button"
              className={`px-3 py-1 text-xs font-semibold rounded-lg ${view === "kanban" ? "bg-ink text-white" : "text-slate-500"}`}
              onClick={() => setView("kanban")}
            >
              Kanban
            </button>
            <button
              type="button"
              className={`px-3 py-1 text-xs font-semibold rounded-lg ${view === "table" ? "bg-ink text-white" : "text-slate-500"}`}
              onClick={() => setView("table")}
            >
              Tabla
            </button>
          </div>
          <Button onClick={createOpportunity}>Nueva oportunidad</Button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {stageList.map((stage) => {
            const rows = grouped.get(stage.id) || [];
            return (
              <Card key={stage.id} className="p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-700">{stage.name}</h2>
                  <span className="text-xs text-slate-400">{rows.length}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {rows.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className="w-full rounded-2xl border border-line p-3 text-left transition hover:bg-mist"
                      onClick={() => openOpportunity(row.id)}
                    >
                      <p className="text-sm font-semibold text-slate-800">{row.title}</p>
                      <p className="text-xs text-slate-500">{row.client_name || "-"}</p>
                      <p className="text-xs text-slate-400">{row.responsible_name || "-"}</p>
                    </button>
                  ))}
                  {!rows.length && !loading && (
                    <p className="text-xs text-slate-400">Sin oportunidades.</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-4">
          <div className="flex items-center justify-between pb-3 text-xs text-slate-400">
            <span>{loading ? "Cargando..." : `${opportunities.length} oportunidades`}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-mist text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Oportunidad</th>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">Etapa</th>
                  <th className="px-3 py-2 text-left">Responsable</th>
                  <th className="px-3 py-2 text-left">Contactos</th>
                  <th className="px-3 py-2 text-left">Creada</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-t border-slate-100 hover:bg-mist/50"
                    onClick={() => openOpportunity(row.id)}
                  >
                    <td className="px-3 py-2 font-medium text-slate-800">{row.title}</td>
                    <td className="px-3 py-2">{row.client_name || "-"}</td>
                    <td className="px-3 py-2">{row.stage_name || "-"}</td>
                    <td className="px-3 py-2">{row.responsible_name || "-"}</td>
                    <td className="px-3 py-2">{row.contacts_count ?? 0}</td>
                    <td className="px-3 py-2">{row.created_at ? formatDateTime(row.created_at) : "-"}</td>
                  </tr>
                ))}
                {!opportunities.length && !loading && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-400">
                      Sin oportunidades.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {dialogs}
    </div>
  );
}
