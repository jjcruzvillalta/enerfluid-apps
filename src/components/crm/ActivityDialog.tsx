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
import { useAuth } from "@/context/AuthContext";

type ActivityDialogProps = {
  open: boolean;
  activityId?: string | null;
  mode?: "create" | "view";
  initialClientId?: string | null;
  onClose: () => void;
  onSaved?: () => void;
  refreshToken?: number;
  onOpenClient?: (id: string) => void;
  onOpenOpportunity?: (id: string) => void;
  onOpenContact?: (id: string) => void;
  onOpenNote?: (id: string) => void;
  onCreateNote?: (context: { activityId: string; parentNoteId?: string; parentPreview?: string }) => void;
};

type ActivityDetail = {
  activity: {
    id: string;
    activity_type_id?: string | null;
    client_id?: string | null;
    opportunity_id?: string | null;
    responsible_user_id?: string | null;
    scheduled_at?: string | null;
    detail?: string | null;
    outcome_id?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };
  type?: { id: string; name: string } | null;
  outcome?: { id: string; name: string; is_effective?: boolean | null } | null;
  responsible?: { id: string; name: string } | null;
  client?: { id: string; name: string } | null;
  opportunity?: { id: string; title: string } | null;
  contacts: { id: string; name: string; role?: string | null; phone?: string | null; email?: string | null }[];
  notes: {
    id: string;
    detail: string;
    author_name?: string | null;
    parent_note_id?: string | null;
    created_at?: string | null;
  }[];
};

type Option = { id: string; name: string };

type NoteThread = ActivityDetail["notes"][0] & { replies: ActivityDetail["notes"] };

const toDateTimeInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

export function ActivityDialog({
  open,
  activityId,
  mode = "view",
  initialClientId,
  onClose,
  onSaved,
  refreshToken,
  onOpenClient,
  onOpenOpportunity,
  onOpenContact,
  onOpenNote,
  onCreateNote,
}: ActivityDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(mode === "create");
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [clients, setClients] = useState<Option[]>([]);
  const [contacts, setContacts] = useState<Option[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [types, setTypes] = useState<Option[]>([]);
  const [outcomes, setOutcomes] = useState<Option[]>([]);
  const [opportunities, setOpportunities] = useState<Option[]>([]);
  const [contactSelection, setContactSelection] = useState<Set<string>>(new Set());
  const [contactFilter, setContactFilter] = useState("");
  const [draft, setDraft] = useState({
    activity_type_id: "",
    client_id: "",
    opportunity_id: "",
    responsible_user_id: "",
    scheduled_at: "",
    detail: "",
    outcome_id: "",
  });

  const isCreate = mode === "create";

  useEffect(() => {
    if (!open) return;
    const loadConfig = async () => {
      const [clientsRes, usersRes, typesRes, outcomesRes] = await Promise.all([
        fetch("/api/crm/clients", { cache: "no-store", credentials: "include" }),
        fetch("/api/crm/users", { cache: "no-store", credentials: "include" }),
        fetch("/api/crm/config?kind=activity-types", { cache: "no-store", credentials: "include" }),
        fetch("/api/crm/config?kind=activity-outcomes", { cache: "no-store", credentials: "include" }),
      ]);
      if (clientsRes.ok) {
        const data = await clientsRes.json();
        setClients(data?.clients || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers((data?.users || []).map((row: any) => ({ id: row.id, name: row.display_name || row.username })));
      }
      if (typesRes.ok) {
        const data = await typesRes.json();
        setTypes(data?.items || []);
      }
      if (outcomesRes.ok) {
        const data = await outcomesRes.json();
        setOutcomes(data?.items || []);
      }
    };
    loadConfig();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const loadOpportunities = async () => {
      const params = new URLSearchParams();
      if (draft.client_id) params.set("clientId", draft.client_id);
      const res = await fetch(`/api/crm/opportunities?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      const items = (data?.opportunities || []).map((row: any) => ({ id: row.id, name: row.title || row.name || row.id }));
      setOpportunities(items);
      if (draft.opportunity_id && !items.some((row: any) => row.id === draft.opportunity_id)) {
        setDraft((prev) => ({ ...prev, opportunity_id: "" }));
      }
    };
    loadOpportunities();
  }, [open, draft.client_id, draft.opportunity_id]);

  useEffect(() => {
    if (!open) return;
    const loadContacts = async () => {
      const res = await fetch(`/api/crm/contacts${draft.client_id ? `?clientId=${draft.client_id}` : ""}`,
        { cache: "no-store", credentials: "include" }
      );
      if (!res.ok) return;
      const data = await res.json();
      setContacts((data?.contacts || []).map((row: any) => ({ id: row.id, name: row.name })));
    };
    loadContacts();
  }, [open, draft.client_id]);

  const loadDetail = async () => {
    if (!activityId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/activities/${activityId}`, { cache: "no-store", credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setDetail(data);
      setDraft({
        activity_type_id: data?.activity?.activity_type_id || "",
        client_id: data?.activity?.client_id || "",
        opportunity_id: data?.activity?.opportunity_id || "",
        responsible_user_id: data?.activity?.responsible_user_id || "",
        scheduled_at: toDateTimeInput(data?.activity?.scheduled_at),
        detail: data?.activity?.detail || "",
        outcome_id: data?.activity?.outcome_id || "",
      });
      setContactSelection(new Set((data?.contacts || []).map((contact: any) => contact.id)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setEditing(isCreate);
    if (isCreate) {
      setDetail(null);
      setDraft({
        activity_type_id: "",
        client_id: initialClientId || "",
        opportunity_id: "",
        responsible_user_id: user?.id || "",
        scheduled_at: toDateTimeInput(new Date().toISOString()),
        detail: "",
        outcome_id: "",
      });
      setContactSelection(new Set());
      return;
    }
    loadDetail();
  }, [open, activityId, isCreate, initialClientId]);

  useEffect(() => {
    if (!open || isCreate) return;
    loadDetail();
  }, [refreshToken]);

  const handleSave = async () => {
    if (!draft.scheduled_at) return;
    setSaving(true);
    try {
      const payload = {
        activity_type_id: draft.activity_type_id || null,
        client_id: draft.client_id || null,
        opportunity_id: draft.opportunity_id || null,
        responsible_user_id: draft.responsible_user_id || null,
        scheduled_at: draft.scheduled_at ? new Date(draft.scheduled_at).toISOString() : null,
        detail: draft.detail.trim() || null,
        outcome_id: draft.outcome_id || null,
        contact_ids: Array.from(contactSelection),
      };
      const res = await fetch(isCreate ? "/api/crm/activities" : `/api/crm/activities/${activityId}`, {
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

  const filteredContacts = useMemo(() => {
    const list = contacts;
    if (!contactFilter.trim()) return list;
    const search = contactFilter.toLowerCase();
    return list.filter((row) => row.name.toLowerCase().includes(search));
  }, [contacts, contactFilter]);

  const noteThreads = useMemo<NoteThread[]>(() => {
    const notes = detail?.notes || [];
    const map = new Map<string, NoteThread>();
    notes.forEach((note) => {
      map.set(note.id, { ...note, replies: [] });
    });
    notes.forEach((note) => {
      if (note.parent_note_id && map.has(note.parent_note_id)) {
        map.get(note.parent_note_id)!.replies.push(note);
      }
    });
    return notes.filter((note) => !note.parent_note_id).map((note) => map.get(note.id)!).filter(Boolean);
  }, [detail]);

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="w-[96vw] max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogClose asChild>
          <button
            type="button"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white/95 text-slate-500 shadow-soft transition hover:bg-white hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogClose>
        <DialogHeader className="flex flex-col gap-1">
          <DialogTitle>{isCreate ? "Nueva actividad" : detail?.type?.name || "Actividad"}</DialogTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{detail?.activity?.scheduled_at ? formatDateTime(detail.activity.scheduled_at) : ""}</span>
            {detail?.outcome?.name ? <Badge variant="outline">{detail.outcome.name}</Badge> : null}
          </div>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-slate-400">Cargando...</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <DetailSection title="Detalle de actividad">
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldRow label="Tipo" value={detail?.type?.name} editing={editing}>
                    <select
                      className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink shadow-sm"
                      value={draft.activity_type_id}
                      onChange={(event) => setDraft((prev) => ({ ...prev, activity_type_id: event.target.value }))}
                    >
                      <option value="">Sin tipo</option>
                      {types.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                  <FieldRow label="Resultado" value={detail?.outcome?.name} editing={editing}>
                    <select
                      className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink shadow-sm"
                      value={draft.outcome_id}
                      onChange={(event) => setDraft((prev) => ({ ...prev, outcome_id: event.target.value }))}
                    >
                      <option value="">Sin resultado</option>
                      {outcomes.map((outcome) => (
                        <option key={outcome.id} value={outcome.id}>
                          {outcome.name}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                  <FieldRow label="Cliente" value={detail?.client?.name} editing={editing}>
                    <select
                      className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink shadow-sm"
                      value={draft.client_id}
                      onChange={(event) => setDraft((prev) => ({ ...prev, client_id: event.target.value }))}
                    >
                      <option value="">Sin cliente</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                  <FieldRow label="Oportunidad" value={detail?.opportunity?.title} editing={editing}>
                    <select
                      className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink shadow-sm"
                      value={draft.opportunity_id}
                      onChange={(event) => setDraft((prev) => ({ ...prev, opportunity_id: event.target.value }))}
                    >
                      <option value="">Sin oportunidad</option>
                      {opportunities.map((opp) => (
                        <option key={opp.id} value={opp.id}>
                          {opp.name}
                        </option>
                      ))}
                    </select>
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
                  <FieldRow label="Fecha y hora" value={detail?.activity?.scheduled_at} editing={editing}>
                    <Input
                      type="datetime-local"
                      value={draft.scheduled_at}
                      onChange={(event) => setDraft((prev) => ({ ...prev, scheduled_at: event.target.value }))}
                    />
                  </FieldRow>
                  <div className="md:col-span-2">
                    <FieldRow label="Detalle" value={detail?.activity?.detail} editing={editing}>
                      <textarea
                        className="min-h-[90px] w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                        value={draft.detail}
                        onChange={(event) => setDraft((prev) => ({ ...prev, detail: event.target.value }))}
                        placeholder="Detalle de la actividad"
                      />
                    </FieldRow>
                  </div>
                </div>
              </DetailSection>

              <DetailSection title="Contactos vinculados">
                {editing ? (
                  <>
                    <Input
                      placeholder="Filtrar contactos"
                      value={contactFilter}
                      onChange={(event) => setContactFilter(event.target.value)}
                    />
                    <div className="mt-3 max-h-40 space-y-2 overflow-auto">
                      {filteredContacts.map((contact) => {
                        const checked = contactSelection.has(contact.id);
                        return (
                          <label key={contact.id} className="flex items-center gap-2 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setContactSelection((prev) => {
                                  const next = new Set(prev);
                                  if (checked) next.delete(contact.id);
                                  else next.add(contact.id);
                                  return next;
                                });
                              }}
                            />
                            <span>{contact.name}</span>
                          </label>
                        );
                      })}
                      {!filteredContacts.length ? <p className="text-xs text-slate-400">Sin contactos.</p> : null}
                    </div>
                  </>
                ) : (
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
                )}
              </DetailSection>
            </div>

            <div className="space-y-4">
              <DetailSection title="Notas">
                <div className="flex items-center justify-between pb-2">
                  <p className="text-xs text-slate-400">{detail?.notes?.length || 0} notas</p>
                  {!isCreate && activityId ? (
                    <Button size="sm" variant="outline" onClick={() => onCreateNote?.({ activityId })}>
                      Nueva nota
                    </Button>
                  ) : null}
                </div>
                <div className="space-y-3">
                  {noteThreads.map((note) => (
                    <div key={note.id} className="rounded-xl border border-line bg-white px-3 py-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-ink">{note.author_name || "-"}</span>
                        <span>{note.created_at ? note.created_at.slice(0, 10) : "-"}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{note.detail}</p>
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => onOpenNote?.(note.id)}>
                          Ver nota
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            onCreateNote?.({ activityId: activityId || "", parentNoteId: note.id, parentPreview: note.detail })
                          }
                        >
                          Responder
                        </Button>
                      </div>
                      {note.replies.length ? (
                        <div className="mt-3 space-y-2 border-l border-line pl-3">
                          {note.replies.map((reply) => (
                            <div key={reply.id} className="text-xs text-slate-600">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-ink">{reply.author_name || "-"}</span>
                                <span>{reply.created_at ? reply.created_at.slice(0, 10) : "-"}</span>
                              </div>
                              <p className="mt-1 text-sm text-slate-700">{reply.detail}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {!noteThreads.length ? <p className="text-xs text-slate-400">Sin notas.</p> : null}
                </div>
              </DetailSection>

              <DetailSection title="Relacion">
                <div className="space-y-2 text-xs text-slate-500">
                  <div className="flex items-center justify-between">
                    <span>Cliente</span>
                    <span>{detail?.client?.name || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Oportunidad</span>
                    <span>{detail?.opportunity?.title || "-"}</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {detail?.client?.id ? (
                    <Button size="sm" variant="outline" onClick={() => onOpenClient?.(detail.client!.id)}>
                      Ver cliente
                    </Button>
                  ) : null}
                  {detail?.opportunity?.id ? (
                    <Button size="sm" variant="outline" onClick={() => onOpenOpportunity?.(detail.opportunity!.id)}>
                      Ver oportunidad
                    </Button>
                  ) : null}
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
              <Button onClick={handleSave} disabled={!draft.scheduled_at || saving}>
                {saving ? "Guardando..." : "Crear"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing((prev) => !prev)}>
                {editing ? "Cancelar" : "Editar"}
              </Button>
              {editing ? (
                <Button onClick={handleSave} disabled={!draft.scheduled_at || saving}>
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
