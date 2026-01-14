"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartWrap } from "@/components/inventory/ChartWrap";
import { formatCurrency } from "@/lib/data";

ChartJS.register(BarElement, CategoryScale, Legend, LineElement, LinearScale, PointElement, Tooltip);

type MetricsPayload = {
  counts: {
    clients: number;
    contacts: number;
    openDeals: number;
    activitiesToday: number;
    pipelineValue: number;
  };
  pipelineStages: { stage: string; count: number; value: number }[];
  activitiesByWeek: { week: string; count: number }[];
  recentActivities: {
    id: string;
    title: string;
    due_at?: string | null;
    created_at?: string | null;
    owner?: string | null;
    client_name?: string;
  }[];
};

const barOptions: ChartOptions<"bar"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label(context) {
          return formatCurrency(context.parsed.y);
        },
      },
    },
  },
  scales: {
    x: { ticks: { color: "#64748b", font: { size: 11 } }, grid: { display: false } },
    y: { ticks: { color: "#64748b", font: { size: 11 } }, grid: { color: "rgba(15, 23, 42, 0.08)" } },
  },
};

const lineOptions: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: "#64748b", font: { size: 11 } }, grid: { display: false } },
    y: { ticks: { color: "#64748b", font: { size: 11 } }, grid: { color: "rgba(15, 23, 42, 0.08)" } },
  },
};

export default function CrmDashboard() {
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/crm/metrics", { cache: "no-store", credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setMetrics(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const stats = useMemo(() => {
    const counts = metrics?.counts;
    return [
      { label: "Clientes activos", value: counts ? counts.clients : "-" },
      { label: "Oportunidades abiertas", value: counts ? counts.openDeals : "-" },
      { label: "Actividades hoy", value: counts ? counts.activitiesToday : "-" },
      { label: "Pipeline (USD)", value: counts ? formatCurrency(counts.pipelineValue || 0) : "-" },
    ];
  }, [metrics]);

  const pipelineChartData = useMemo(() => {
    if (!metrics?.pipelineStages?.length) return null;
    return {
      labels: metrics.pipelineStages.map((row) => row.stage),
      datasets: [
        {
          label: "Pipeline",
          data: metrics.pipelineStages.map((row) => row.value || 0),
          backgroundColor: "rgba(37, 99, 235, 0.75)",
          borderRadius: 10,
        },
      ],
    };
  }, [metrics]);

  const activitiesChartData = useMemo(() => {
    if (!metrics?.activitiesByWeek?.length) return null;
    return {
      labels: metrics.activitiesByWeek.map((row) => row.week),
      datasets: [
        {
          label: "Actividades",
          data: metrics.activitiesByWeek.map((row) => row.count),
          borderColor: "#0f172a",
          backgroundColor: "rgba(15, 23, 42, 0.12)",
          tension: 0.2,
          pointRadius: 3,
        },
      ],
    };
  }, [metrics]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">Resumen general de clientes y oportunidades.</p>
        </div>
        <Button>Crear oportunidad</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-4 shadow-soft">
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-800">{stat.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <ChartWrap title="Pipeline por etapa" empty={!pipelineChartData}>
          {pipelineChartData && <Bar data={pipelineChartData} options={barOptions} />}
        </ChartWrap>
        <ChartWrap title="Actividades (12 semanas)" empty={!activitiesChartData}>
          {activitiesChartData && <Line data={activitiesChartData} options={lineOptions} />}
        </ChartWrap>
      </div>

      <Card className="p-6">
        <h2 className="text-sm font-semibold text-slate-700">Actividades recientes</h2>
        <div className="mt-4 space-y-3">
          {metrics?.recentActivities?.map((row) => {
            const dateLabel = row.due_at || row.created_at;
            return (
              <div key={row.id} className="flex items-center justify-between text-sm text-slate-600">
                <span>
                  {row.title || "Actividad"} · {row.client_name || "-"}
                </span>
                <span className="text-xs text-slate-400">{dateLabel ? dateLabel.slice(0, 10) : "-"}</span>
              </div>
            );
          })}
          {!loading && !metrics?.recentActivities?.length ? (
            <p className="text-sm text-slate-400">Sin actividades recientes.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
