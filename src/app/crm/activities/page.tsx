"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/data";

type ActivityRow = {
  id: string;
  title: string;
  type?: string | null;
  status?: string | null;
  due_at?: string | null;
  created_at?: string | null;
  owner?: string | null;
  client_name?: string | null;
};

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ q: "", status: "" });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.q) params.set("q", filters.q);
        if (filters.status) params.set("status", filters.status);
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
  }, [filters]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Actividades</h1>
          <p className="text-sm text-slate-500">Agenda y seguimiento diario.</p>
        </div>
        <Button>Nueva actividad</Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
          <Input
            placeholder="Buscar actividad"
            value={filters.q}
            onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
          />
          <Input
            placeholder="Estado (pendiente/completada)"
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
          />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between pb-3 text-xs text-slate-400">
          <span>{loading ? "Cargando..." : `${activities.length} actividades`}</span>
        </div>
        <div className="space-y-3">
          {activities.map((row) => (
            <div key={row.id} className="flex items-center justify-between rounded-2xl border border-line px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{row.title}</p>
                <p className="text-xs text-slate-500">
                  {row.client_name || "-"} · {row.owner || "-"}
                </p>
              </div>
              <div className="text-right">
                <Badge variant="outline">{row.status || "pendiente"}</Badge>
                <p className="mt-1 text-xs text-slate-400">
                  {formatDateTime(row.due_at || row.created_at)}
                </p>
              </div>
            </div>
          ))}
          {!activities.length && !loading && (
            <p className="text-sm text-slate-400">Sin actividades para mostrar.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
