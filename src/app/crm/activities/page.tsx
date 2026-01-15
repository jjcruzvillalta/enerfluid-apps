"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/data";
import { useCrmDialogs } from "@/components/crm/useCrmDialogs";

type ActivityRow = {
  id: string;
  scheduled_at?: string | null;
  type_name?: string | null;
  outcome_name?: string | null;
  detail?: string | null;
  client_name?: string | null;
  responsible_name?: string | null;
};

type Option = { id: string; name: string };

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [types, setTypes] = useState<Option[]>([]);
  const [outcomes, setOutcomes] = useState<Option[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [filters, setFilters] = useState({ q: "", typeId: "", outcomeId: "", responsibleId: "" });
  const { openActivity, createActivity, dialogs } = useCrmDialogs({
    onRefresh: () => setRefreshToken((prev) => prev + 1),
  });

  useEffect(() => {
    const loadConfig = async () => {
      const [typesRes, outcomesRes, usersRes] = await Promise.all([
        fetch("/api/crm/config?kind=activity-types", { cache: "no-store", credentials: "include" }),
        fetch("/api/crm/config?kind=activity-outcomes", { cache: "no-store", credentials: "include" }),
        fetch("/api/crm/users", { cache: "no-store", credentials: "include" }),
      ]);
      if (typesRes.ok) {
        const data = await typesRes.json();
        setTypes(data?.items || []);
      }
      if (outcomesRes.ok) {
        const data = await outcomesRes.json();
        setOutcomes(data?.items || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers((data?.users || []).map((row: any) => ({ id: row.id, name: row.display_name || row.username })));
      }
    };
    loadConfig();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.q) params.set("q", filters.q);
        if (filters.typeId) params.set("typeId", filters.typeId);
        if (filters.outcomeId) params.set("outcomeId", filters.outcomeId);
        if (filters.responsibleId) params.set("responsibleId", filters.responsibleId);
        const res = await fetch(`/api/crm/activities?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        setActivities(data?.activities || []);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Actividades</h1>
          <p className="text-sm text-slate-500">Agenda y seguimiento diario.</p>
        </div>
        <Button onClick={() => createActivity()}>Nueva actividad</Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            placeholder="Buscar por detalle"
            value={filters.q}
            onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
          />
          <select
            className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink shadow-sm"
            value={filters.typeId}
            onChange={(event) => setFilters((prev) => ({ ...prev, typeId: event.target.value }))}
          >
            <option value="">Tipo</option>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink shadow-sm"
            value={filters.outcomeId}
            onChange={(event) => setFilters((prev) => ({ ...prev, outcomeId: event.target.value }))}
          >
            <option value="">Resultado</option>
            {outcomes.map((outcome) => (
              <option key={outcome.id} value={outcome.id}>
                {outcome.name}
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

      <Card className="p-4">
        <div className="flex items-center justify-between pb-3 text-xs text-slate-400">
          <span>{loading ? "Cargando..." : `${activities.length} actividades`}</span>
        </div>
        <div className="space-y-3">
          {activities.map((row) => (
            <button
              key={row.id}
              type="button"
              className="flex w-full items-center justify-between rounded-2xl border border-line px-4 py-3 text-left transition hover:bg-mist"
              onClick={() => openActivity(row.id)}
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">{row.type_name || "Actividad"}</p>
                <p className="text-xs text-slate-500">
                  {row.client_name || "-"} / {row.responsible_name || "-"}
                </p>
                {row.detail ? <p className="text-xs text-slate-400">{row.detail}</p> : null}
              </div>
              <div className="text-right">
                <Badge variant="outline">{row.outcome_name || "pendiente"}</Badge>
                <p className="mt-1 text-xs text-slate-400">{formatDateTime(row.scheduled_at)}</p>
              </div>
            </button>
          ))}
          {!activities.length && !loading && (
            <p className="text-sm text-slate-400">Sin actividades para mostrar.</p>
          )}
        </div>
      </Card>
      {dialogs}
    </div>
  );
}
