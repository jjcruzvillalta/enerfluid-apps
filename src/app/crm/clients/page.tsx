"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ClientRow = {
  id: string;
  name: string;
  industry?: string | null;
  city?: string | null;
  owner?: string | null;
  contacts?: number;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    q: "",
    industry: "",
    city: "",
    owner: "",
  });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.q) params.set("q", filters.q);
        if (filters.industry) params.set("industry", filters.industry);
        if (filters.city) params.set("city", filters.city);
        if (filters.owner) params.set("owner", filters.owner);
        const res = await fetch(`/api/crm/clients?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        setClients(data?.clients || []);
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
          <h1 className="text-2xl font-semibold text-slate-800">Clientes</h1>
          <p className="text-sm text-slate-500">Listado de cuentas y sus contactos clave.</p>
        </div>
        <Button>Nuevo cliente</Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            placeholder="Buscar cliente"
            value={filters.q}
            onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
          />
          <Input
            placeholder="Industria"
            value={filters.industry}
            onChange={(event) => setFilters((prev) => ({ ...prev, industry: event.target.value }))}
          />
          <Input
            placeholder="Ciudad"
            value={filters.city}
            onChange={(event) => setFilters((prev) => ({ ...prev, city: event.target.value }))}
          />
          <Input
            placeholder="Responsable"
            value={filters.owner}
            onChange={(event) => setFilters((prev) => ({ ...prev, owner: event.target.value }))}
          />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between pb-3 text-xs text-slate-400">
          <span>{loading ? "Cargando..." : `${clients.length} clientes`}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 bg-mist">
              <tr>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Industria</th>
                <th className="px-3 py-2 text-left">Ciudad</th>
                <th className="px-3 py-2 text-left">Responsable</th>
                <th className="px-3 py-2 text-left">Contactos</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-mist/50">
                  <td className="px-3 py-2 font-medium text-slate-800">{row.name}</td>
                  <td className="px-3 py-2">{row.industry || "-"}</td>
                  <td className="px-3 py-2">{row.city || "-"}</td>
                  <td className="px-3 py-2">{row.owner || "-"}</td>
                  <td className="px-3 py-2">{row.contacts ?? 0}</td>
                </tr>
              ))}
              {!clients.length && !loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-400">
                    Sin clientes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
