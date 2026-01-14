"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/data";

type OpportunityRow = {
  id: string;
  name: string;
  stage?: string | null;
  value?: number | null;
  client_name?: string | null;
};

const DEFAULT_STAGE_ORDER = ["solicitud recibida", "oferta enviada", "ganada", "perdida"];

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [loading, setLoading] = useState(false);

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
  }, []);

  const stages = useMemo(() => {
    const stageSet = new Set(opportunities.map((row) => row.stage || "Sin etapa"));
    const list = Array.from(stageSet);
    return list.sort((a, b) => {
      const idxA = DEFAULT_STAGE_ORDER.indexOf(a.toLowerCase());
      const idxB = DEFAULT_STAGE_ORDER.indexOf(b.toLowerCase());
      if (idxA !== -1 || idxB !== -1) {
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      }
      return a.localeCompare(b, "es");
    });
  }, [opportunities]);

  const grouped = useMemo(() => {
    const map = new Map<string, OpportunityRow[]>();
    stages.forEach((stage) => map.set(stage, []));
    opportunities.forEach((row) => {
      const stage = row.stage || "Sin etapa";
      if (!map.has(stage)) map.set(stage, []);
      map.get(stage)!.push(row);
    });
    return map;
  }, [opportunities, stages]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Oportunidades</h1>
          <p className="text-sm text-slate-500">Pipeline comercial por etapa.</p>
        </div>
        <Button>Nueva oportunidad</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {stages.map((stage) => {
          const rows = grouped.get(stage) || [];
          const totalValue = rows.reduce((sum, row) => sum + Number(row.value || 0), 0);
          return (
            <Card key={stage} className="p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">{stage}</h2>
                <span className="text-xs text-slate-400">{rows.length}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{formatCurrency(totalValue)}</p>
              <div className="mt-4 space-y-3">
                {rows.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-line p-3">
                    <p className="text-sm font-semibold text-slate-800">{row.name}</p>
                    <p className="text-xs text-slate-500">{row.client_name || "-"}</p>
                    <p className="text-xs font-semibold text-slate-700">{formatCurrency(row.value || 0)}</p>
                  </div>
                ))}
                {!rows.length && !loading && (
                  <p className="text-xs text-slate-400">Sin oportunidades.</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
