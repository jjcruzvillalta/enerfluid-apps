"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ContactRow = {
  id: string;
  name: string;
  client_name?: string | null;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    q: "",
    company: "",
    role: "",
  });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.q) params.set("q", filters.q);
        if (filters.role) params.set("role", filters.role);
        const res = await fetch(`/api/crm/contacts?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        let rows = data?.contacts || [];
        if (filters.company) {
          const search = filters.company.toLowerCase();
          rows = rows.filter((row: ContactRow) =>
            String(row.client_name || "").toLowerCase().includes(search)
          );
        }
        setContacts(rows);
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
          <h1 className="text-2xl font-semibold text-slate-800">Contactos</h1>
          <p className="text-sm text-slate-500">Personas clave por cuenta.</p>
        </div>
        <Button>Nuevo contacto</Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            placeholder="Buscar contacto"
            value={filters.q}
            onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
          />
          <Input
            placeholder="Empresa"
            value={filters.company}
            onChange={(event) => setFilters((prev) => ({ ...prev, company: event.target.value }))}
          />
          <Input
            placeholder="Rol"
            value={filters.role}
            onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value }))}
          />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between pb-3 text-xs text-slate-400">
          <span>{loading ? "Cargando..." : `${contacts.length} contactos`}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 bg-mist">
              <tr>
                <th className="px-3 py-2 text-left">Contacto</th>
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-left">Rol</th>
                <th className="px-3 py-2 text-left">Telefono</th>
                <th className="px-3 py-2 text-left">Email</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-mist/50">
                  <td className="px-3 py-2 font-medium text-slate-800">{row.name}</td>
                  <td className="px-3 py-2">{row.client_name || "-"}</td>
                  <td className="px-3 py-2">{row.role || "-"}</td>
                  <td className="px-3 py-2">{row.phone || "-"}</td>
                  <td className="px-3 py-2">{row.email || "-"}</td>
                </tr>
              ))}
              {!contacts.length && !loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-400">
                    Sin contactos.
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
