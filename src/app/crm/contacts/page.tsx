"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCrmDialogs } from "@/components/crm/useCrmDialogs";

type ContactRow = {
  id: string;
  name: string;
  client_name?: string | null;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
};

type Option = { id: string; name: string };

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [clients, setClients] = useState<Option[]>([]);
  const [filters, setFilters] = useState({
    q: "",
    clientId: "",
  });
  const { openContact, createContact, dialogs } = useCrmDialogs({
    onRefresh: () => setRefreshToken((prev) => prev + 1),
  });

  useEffect(() => {
    const loadClients = async () => {
      const res = await fetch("/api/crm/clients", { cache: "no-store", credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setClients(data?.clients || []);
    };
    loadClients();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.q) params.set("q", filters.q);
        if (filters.clientId) params.set("clientId", filters.clientId);
        const res = await fetch(`/api/crm/contacts?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        setContacts(data?.contacts || []);
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
          <h1 className="text-2xl font-semibold text-slate-800">Contactos</h1>
          <p className="text-sm text-slate-500">Personas clave por cuenta.</p>
        </div>
        <Button onClick={() => createContact()}>Nuevo contacto</Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            placeholder="Buscar contacto"
            value={filters.q}
            onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
          />
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
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between pb-3 text-xs text-slate-400">
          <span>{loading ? "Cargando..." : `${contacts.length} contactos`}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-mist text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Contacto</th>
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-left">Cargo</th>
                <th className="px-3 py-2 text-left">Telefono</th>
                <th className="px-3 py-2 text-left">Email</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-t border-slate-100 hover:bg-mist/50"
                  onClick={() => openContact(row.id)}
                >
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
      {dialogs}
    </div>
  );
}
