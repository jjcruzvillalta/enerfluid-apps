"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
type Option = { id: string; name: string };

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [clients, setClients] = useState<Option[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    q: "",
    stageId: "",
    clientId: "",
    responsibleId: "",
  });
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
    const loadFilters = async () => {
      const [clientsRes, usersRes] = await Promise.all([
        fetch("/api/crm/clients", { cache: "no-store", credentials: "include" }),
        fetch("/api/crm/users", { cache: "no-store", credentials: "include" }),
      ]);
      if (clientsRes.ok) {
        const data = await clientsRes.json();
        setClients(data?.clients || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers((data?.users || []).map((row: any) => ({ id: row.id, name: row.display_name || row.username })));
      }
    };
    loadFilters();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.q) params.set("q", filters.q);
        if (filters.stageId) params.set("stageId", filters.stageId);
        if (filters.clientId) params.set("clientId", filters.clientId);
        if (filters.responsibleId) params.set("responsibleId", filters.responsibleId);
        const res = await fetch(`/api/crm/opportunities?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        setOpportunities(data?.opportunities || []);
      } finally {
        setLoading(false);
      }
    };
    const timeout = setTimeout(load, 200);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [filters, refreshToken]);

  const stageOrder = useMemo(() => stages.map((stage) => stage.id), [stages]);
  const stageNameMap = useMemo(() => new Map(stages.map((stage) => [stage.id, stage.name])), [stages]);

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
    const list = stageOrder.map((id) => ({ id, name: stageNameMap.get(id) || "" }));
    list.push({ id: "sin_etapa", name: "Sin etapa" });
    return list;
  }, [stageOrder, stageNameMap]);

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>, stageId: string) => {
    event.preventDefault();
    const opportunityId = event.dataTransfer.getData("text/plain");
    if (!opportunityId) return;
    const current = opportunities.find((row) => row.id === opportunityId);
    const nextStageId = stageId === "sin_etapa" ? null : stageId;
    if (current && (current.stage_id || "sin_etapa") === stageId) return;
    const res = await fetch(`/api/crm/opportunities/${opportunityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ stage_id: nextStageId }),
    });
    if (!res.ok) return;
    setOpportunities((prev) =>
      prev.map((row) =>
        row.id === opportunityId
          ? {
              ...row,
              stage_id: nextStageId,
              stage_name: nextStageId ? stageNameMap.get(nextStageId) || "-" : "Sin etapa",
            }
          : row
      )
    );
    setDragOverStage(null);
  };

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
              className={`rounded-lg px-3 py-1 text-xs font-semibold ${view === "kanban" ? "bg-ink text-white" : "text-slate-500"}`}
              onClick={() => setView("kanban")}
            >
              Kanban
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1 text-xs font-semibold ${view === "table" ? "bg-ink text-white" : "text-slate-500"}`}
              onClick={() => setView("table")}
            >
              Tabla
            </button>
          </div>
          <Button onClick={() => createOpportunity()}>Nueva oportunidad</Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            placeholder="Buscar oportunidad"
            value={filters.q}
            onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
          />
          <select
            className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink shadow-sm"
            value={filters.stageId}
            onChange={(event) => setFilters((prev) => ({ ...prev, stageId: event.target.value }))}
          >
            <option value="">Etapa</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
            <option value="sin_etapa">Sin etapa</option>
          </select>
          <select
            className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink shadow-sm"
            value={filters.clientId}
            onChange={(event) => setFilters((prev) => ({ ...prev, clientId: event.target.value }))}
          >
            <option value="">Cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink shadow-sm"
            value={filters.responsibleId}
            onChange={(event) => setFilters((prev) => ({ ...prev, responsibleId: event.target.value }))}
          >
            <option value="">Responsable</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {view === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {stageList.map((stage) => {
            const rows = grouped.get(stage.id) || [];
            return (
              <Card
                key={stage.id}
                className={`min-w-[260px] shrink-0 p-4 ${dragOverStage === stage.id ? "ring-2 ring-accent/40" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverStage(stage.id);
                }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={(event) => handleDrop(event, stage.id)}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-700">{stage.name}</h2>
                  <span className="text-xs text-slate-400">{rows.length}</span>
                </div>
                <div className="mt-4 min-h-[80px] space-y-3">
                  {rows.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className={`w-full rounded-2xl border border-line p-3 text-left transition hover:bg-mist ${draggingId === row.id ? "opacity-60" : ""}`}
                      onClick={() => openOpportunity(row.id)}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", row.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDraggingId(row.id);
                      }}
                      onDragEnd={() => setDraggingId(null)}
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
