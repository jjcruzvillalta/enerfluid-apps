"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  ArcElement,
  type ChartOptions,
} from "chart.js";
import { Card } from "@/components/ui/card";
import { ChartWrap } from "@/components/inventory/ChartWrap";
import { palette, formatDateTime } from "@/lib/data";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, ArcElement);

type AnalysisPayload = {
  activitiesByWeek: { labels: string[]; datasets: { label: string; data: number[] }[] };
  effectiveActivitiesByWeek: { labels: string[]; datasets: { label: string; data: number[] }[] };
  wonOpportunitiesByMonth: { labels: string[]; data: number[] };
  topClients: { labels: string[]; values: number[] };
  recentActivities: {
    id: string;
    scheduled_at?: string | null;
    detail?: string | null;
    client_name?: string | null;
    responsible_name?: string | null;
    type_name?: string | null;
    outcome_name?: string | null;
  }[];
};

type UserOption = { id: string; name: string };

const stackedBarOptions: ChartOptions<"bar"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: "bottom" } },
  scales: {
    x: { stacked: true, ticks: { color: "#64748b", font: { size: 11 } }, grid: { display: false } },
    y: { stacked: true, ticks: { color: "#64748b", font: { size: 11 } }, grid: { color: "rgba(15, 23, 42, 0.08)" } },
  },
};

const barOptions: ChartOptions<"bar"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: "#64748b", font: { size: 11 } }, grid: { display: false } },
    y: { ticks: { color: "#64748b", font: { size: 11 } }, grid: { color: "rgba(15, 23, 42, 0.08)" } },
  },
};

const pieOptions: ChartOptions<"pie"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: "right" } },
};

export default function CrmAnalysisPage() {
  const [data, setData] = useState<AnalysisPayload | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userFilter, setUserFilter] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      const res = await fetch("/api/crm/users", { cache: "no-store", credentials: "include" });
      if (!res.ok) return;
      const payload = await res.json();
      setUsers((payload?.users || []).map((row: any) => ({ id: row.id, name: row.display_name || row.username })));
    };
    loadUsers();
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (userFilter) params.set("userId", userFilter);
        const res = await fetch(`/api/crm/analysis?${params.toString()}`, { cache: "no-store", credentials: "include" });
        if (!res.ok) return;
        const payload = await res.json();
        setData(payload);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userFilter]);

  const activityChart = useMemo(() => {
    if (!data?.activitiesByWeek?.labels?.length) return null;
    return {
      labels: data.activitiesByWeek.labels,
      datasets: data.activitiesByWeek.datasets.map((row, idx) => ({
        label: row.label,
        data: row.data,
        backgroundColor: palette[idx % palette.length],
        stack: "activities",
        borderRadius: 6,
      })),
    };
  }, [data]);

  const effectiveChart = useMemo(() => {
    if (!data?.effectiveActivitiesByWeek?.labels?.length) return null;
    return {
      labels: data.effectiveActivitiesByWeek.labels,
      datasets: data.effectiveActivitiesByWeek.datasets.map((row, idx) => ({
        label: row.label,
        data: row.data,
        backgroundColor: palette[idx % palette.length],
        stack: "effective",
        borderRadius: 6,
      })),
    };
  }, [data]);

  const wonChart = useMemo(() => {
    if (!data?.wonOpportunitiesByMonth?.labels?.length) return null;
    return {
      labels: data.wonOpportunitiesByMonth.labels,
      datasets: [
        {
          label: "Ganadas",
          data: data.wonOpportunitiesByMonth.data,
          backgroundColor: "rgba(15, 23, 42, 0.7)",
          borderRadius: 8,
        },
      ],
    };
  }, [data]);

  const topClientsChart = useMemo(() => {
    if (!data?.topClients?.labels?.length) return null;
    return {
      labels: data.topClients.labels,
      datasets: [
        {
          data: data.topClients.values,
          backgroundColor: data.topClients.labels.map((_label, idx) => palette[idx % palette.length]),
        },
      ],
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Analisis</h1>
          <p className="text-sm text-slate-500">Indicadores clave por actividad y oportunidades ganadas.</p>
        </div>
        <div className="flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center">
          <span>Filtrar por responsable</span>
          <select
            className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink shadow-sm sm:w-auto"
            value={userFilter}
            onChange={(event) => setUserFilter(event.target.value)}
          >
            <option value="">Todos</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartWrap title="Actividades (ultimas 12 semanas)" empty={!activityChart}>
          {activityChart && <Bar data={activityChart} options={stackedBarOptions} />}
        </ChartWrap>
        <ChartWrap title="Actividades efectivas (ultimas 12 semanas)" empty={!effectiveChart}>
          {effectiveChart && <Bar data={effectiveChart} options={stackedBarOptions} />}
        </ChartWrap>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <ChartWrap title="Ventas ganadas (ultimos 12 meses)" empty={!wonChart}>
          {wonChart && <Bar data={wonChart} options={barOptions} />}
        </ChartWrap>
        <ChartWrap title="Top 10 clientes (12 meses)" empty={!topClientsChart}>
          {topClientsChart && <Pie data={topClientsChart} options={pieOptions} />}
        </ChartWrap>
      </div>

      <Card className="p-6">
        <h2 className="text-sm font-semibold text-slate-700">Ultimas actividades</h2>
        <div className="mt-4 space-y-3">
          {data?.recentActivities?.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-1 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between"
            >
              <span>
                {row.type_name || "Actividad"} / {row.client_name || "-"} / {row.responsible_name || "-"}
              </span>
              <span className="text-xs text-slate-400">{formatDateTime(row.scheduled_at)}</span>
            </div>
          ))}
          {!loading && !data?.recentActivities?.length ? (
            <p className="text-sm text-slate-400">Sin actividades recientes.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
