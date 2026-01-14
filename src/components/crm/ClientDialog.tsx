"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { DetailSection } from "@/components/crm/DetailSection";
import { FieldRow } from "@/components/crm/FieldRow";
import { formatDateTime } from "@/lib/data";

type ClientDialogProps = {
  open: boolean;
  clientId?: string | null;
  mode?: "create" | "view";
  onClose: () => void;
  onSaved?: () => void;
  onOpenContact?: (id: string) => void;
  onOpenOpportunity?: (id: string) => void;
  onOpenActivity?: (id: string) => void;
  onCreateOpportunity?: () => void;
  onCreateActivity?: () => void;
  onOpenNote?: (id: string) => void;
  onCreateNote?: (context: { clientId: string; parentNoteId?: string; parentPreview?: string }) => void;
};

type ClientDetail = {
  client: {
    id: string;
    name: string;
    city?: string | null;
    detail?: string | null;
    client_type_id?: string | null;
    responsible_user_id?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };
  client_type?: { id: string; name: string } | null;
  responsible?: { id: string; name: string } | null;
  contacts: { id: string; name: string; role?: string | null; phone?: string | null; email?: string | null }[];
  opportunities: {
    id: string;
    title: string;
    stage_name?: string | null;
    responsible_name?: string | null;
  }[];
  activities: {
    id: string;
    scheduled_at?: string | null;
    created_at?: string | null;
    type_name?: string | null;
    outcome_name?: string | null;
    detail?: string | null;
  }[];
  notes: {
    id: string;
    detail: string;
    author_name?: string | null;
    parent_note_id?: string | null;
    created_at?: string | null;
  }[];
};

type Option = { id: string; name: string };


export function ClientDialog({
  open,
  clientId,
  mode = "view",
  onClose,
  onSaved,
  onOpenContact,
  onOpenOpportunity,
  onOpenActivity,
  onCreateOpportunity,
  onCreateActivity,
  onOpenNote,
  onCreateNote,
}: ClientDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(mode === "create");
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [clientTypes, setClientTypes] = useState<Option[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [draft, setDraft] = useState({
    name: "",
    city: "",
    detail: "",
    client_type_id: "",
    responsible_user_id: "",
  });

  const isCreate = mode === "create";

  useEffect(() => {
    if (!open) return;
    const loadConfig = async () => {
      const [typesRes, usersRes] = await Promise.all([
        fetch("/api/crm/config?kind=client-types", { cache: "no-store", credentials: "include" }),
        fetch("/api/crm/users", { cache: "no-store", credentials: "include" }),
      ]);
      if (typesRes.ok) {
        const data = await typesRes.json();
        setClientTypes(data?.items || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers((data?.users || []).map((row: any) => ({ id: row.id, name: row.display_name || row.username })));
      }
    };
    loadConfig();
  }, [open]);

  const loadDetail = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/clients/${clientId}`, { cache: "no-store", credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setDetail(data);
      setDraft({
        name: data?.client?.name || "",
        city: data?.client?.city || "",
        detail: data?.client?.detail || "",
        client_type_id: data?.client?.client_type_id || "",
        responsible_user_id: data?.client?.responsible_user_id || "",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setEditing(isCreate);
    if (isCreate) {
      setDetail(null);
      setDraft({ name: "", city: "", detail: "", client_type_id: "", responsible_user_id: "" });
      return;
    }
    loadDetail();
  }, [open, clientId, isCreate]);

  const handleSave = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        city: draft.city.trim() || null,
        detail: draft.detail.trim() || null,
        client_type_id: draft.client_type_id || null,
        responsible_user_id: draft.responsible_user_id || null,
      };
      const res = await fetch(isCreate ? "/api/crm/clients" : `/api/crm/clients/${clientId}`, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) return;
      if (!isCreate) await loadDetail();
      onSaved?.();
      if (isCreate) onClose();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const timeline = useMemo(() => {
    const activityItems =
      detail?.activities?.map((activity) => ({
        id: activity.id,
        type: "activity" as const,
        date: activity.scheduled_at || activity.created_at || "",
        title: activity.type_name || "Actividad",
        subtitle: activity.outcome_name || "",
        detail: activity.detail || "",
      })) || [];

    const noteItems =
      detail?.notes?.map((note) => ({
        id: note.id,
        type: "note" as const,
        date: note.created_at || "",
        title: note.author_name || "-",
        subtitle: "",
        detail: note.detail || "",
      })) || [];

    return [...activityItems, ...noteItems].sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      return bTime - aTime;
    });
  }, [detail]);

  const headerTitle = isCreate ? "Nuevo cliente" : detail?.client?.name || "Cliente";

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="w-[96vw] max-w-5xl">
        <DialogClose asChild>
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full border border-line bg-white p-1 text-slate-500 shadow-sm hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogClose>
        <DialogHeader className="flex flex-col gap-1">
          <DialogTitle>{headerTitle}</DialogTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{detail?.client?.updated_at ? `Actualizado ${detail.client.updated_at.slice(0, 10)}` : ""}</span>
            {detail?.client_type?.name ? <Badge variant="outline">{detail.client_type.name}</Badge> : null}
          </div>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-slate-400">Cargando...</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <DetailSection title="Datos del cliente">
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldRow label="Nombre" value={detail?.client?.name} editing={editing}>
                    <Input
                      value={draft.name}
                      onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Nombre del cliente"
                    />
                  </FieldRow>
                  <FieldRow label="Tipo" value={detail?.client_type?.name} editing={editing}>
                    <select
                      className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink shadow-sm"
                      value={draft.client_type_id}
                      onChange={(event) => setDraft((prev) => ({ ...prev, client_type_id: event.target.value }))}
                    >
                      <option value="">Sin tipo</option>
                      {clientTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                  <FieldRow label="Ciudad" value={detail?.client?.city} editing={editing}>
                    <Input
                      value={draft.city}
                      onChange={(event) => setDraft((prev) => ({ ...prev, city: event.target.value }))}
                      placeholder="Ciudad"
                    />
                  </FieldRow>
                  <FieldRow label="Responsable" value={detail?.responsible?.name} editing={editing}>
                    <select
                      className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink shadow-sm"
                      value={draft.responsible_user_id}
                      onChange={(event) => setDraft((prev) => ({ ...prev, responsible_user_id: event.target.value }))}
                    >
                      <option value="">Sin responsable</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                  <div className="md:col-span-2">
                    <FieldRow label="Detalle" value={detail?.client?.detail} editing={editing}>
                      <textarea
                        className="min-h-[90px] w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                        value={draft.detail}
                        onChange={(event) => setDraft((prev) => ({ ...prev, detail: event.target.value }))}
                        placeholder="Notas generales del cliente"
                      />
                    </FieldRow>
                  </div>
                </div>
              </DetailSection>

              <DetailSection title={`Contactos (${detail?.contacts?.length || 0})`}>
                <div className="space-y-2">
                  {(detail?.contacts || []).map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-3 py-2 text-left text-xs text-slate-600 hover:bg-mist"
                      onClick={() => onOpenContact?.(contact.id)}
                    >
                      <span className="font-semibold text-ink">{contact.name}</span>
                      <span>{contact.role || "-"}</span>
                    </button>
                  ))}
                  {!detail?.contacts?.length ? <p className="text-xs text-slate-400">Sin contactos.</p> : null}
                </div>
              </DetailSection>

              <DetailSection title={`Oportunidades (${detail?.opportunities?.length || 0})`}>
                <div className="flex items-center justify-between pb-2">
                  <p className="text-xs text-slate-400">
                    {detail?.opportunities?.length || 0} oportunidades
                  </p>
                  {!isCreate ? (
                    <Button size="sm" variant="outline" onClick={onCreateOpportunity}>
                      Nueva oportunidad
                    </Button>
                  ) : null}
                </div>
                <div className="space-y-2">
                  {(detail?.opportunities || []).map((deal) => (
                    <button
                      key={deal.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-3 py-2 text-left text-xs text-slate-600 hover:bg-mist"
                      onClick={() => onOpenOpportunity?.(deal.id)}
                    >
                      <span className="font-semibold text-ink">{deal.title}</span>
                      <span>{deal.stage_name || "-"}</span>
                    </button>
                  ))}
                  {!detail?.opportunities?.length ? <p className="text-xs text-slate-400">Sin oportunidades.</p> : null}
                </div>
              </DetailSection>
            </div>

            <div className="space-y-4">
              <DetailSection title="Cronologia">
                <div className="flex items-center justify-between pb-2">
                  <p className="text-xs text-slate-400">{timeline.length} eventos</p>
                  <div className="flex gap-2">
                    {!isCreate ? (
                      <Button size="sm" variant="outline" onClick={onCreateActivity}>
                        Nueva actividad
                      </Button>
                    ) : null}
                    {!isCreate && clientId ? (
                      <Button size="sm" variant="outline" onClick={() => onCreateNote?.({ clientId })}>
                        Nueva nota
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-3">
                  {timeline.map((item) => (
                    <div key={`${item.type}-${item.id}`} className="rounded-xl border border-line bg-white px-3 py-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-ink">
                          {item.type === "activity" ? item.title : item.title}
                        </span>
                        <span>{item.date ? formatDateTime(item.date) : "-"}</span>
                      </div>
                      {item.subtitle ? <p className="mt-1 text-xs text-slate-400">{item.subtitle}</p> : null}
                      {item.detail ? <p className="mt-2 text-sm text-slate-700">{item.detail}</p> : null}
                      <div className="mt-2 flex gap-2">
                        {item.type === "activity" ? (
                          <Button size="sm" variant="outline" onClick={() => onOpenActivity?.(item.id)}>
                            Ver actividad
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => onOpenNote?.(item.id)}>
                              Ver nota
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                onCreateNote?.({
                                  clientId: clientId || "",
                                  parentNoteId: item.id,
                                  parentPreview: item.detail,
                                })
                              }
                            >
                              Responder
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {!timeline.length ? <p className="text-xs text-slate-400">Sin eventos.</p> : null}
                </div>
              </DetailSection>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          {isCreate ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={!draft.name.trim() || saving}>
                {saving ? "Guardando..." : "Crear"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing((prev) => !prev)}>
                {editing ? "Cancelar" : "Editar"}
              </Button>
              {editing ? (
                <Button onClick={handleSave} disabled={!draft.name.trim() || saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              ) : null}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
