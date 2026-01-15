"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { DetailSection } from "@/components/crm/DetailSection";
import { FieldRow } from "@/components/crm/FieldRow";
import { formatCurrency, formatDateTime, toNumber } from "@/lib/data";

type OpportunityDialogProps = {
  open: boolean;
  opportunityId?: string | null;
  mode?: "create" | "view";
  initialClientId?: string | null;
  onClose: () => void;
  onSaved?: () => void;
  refreshToken?: number;
  onOpenClient?: (id: string) => void;
  onOpenContact?: (id: string) => void;
  onOpenActivity?: (id: string) => void;
  onCreateActivity?: (context?: { clientId?: string | null }) => void;
  onOpenNote?: (id: string) => void;
  onCreateNote?: (context: { opportunityId: string; parentNoteId?: string; parentPreview?: string }) => void;
};

type OpportunityDetail = {
  opportunity: {
    id: string;
    title: string;
    client_id?: string | null;
    responsible_user_id?: string | null;
    stage_id?: string | null;
    value?: number | null;
    created_at?: string | null;
    updated_at?: string | null;
    closed_at?: string | null;
  };
  client?: { id: string; name: string } | null;
  stage?: { id: string; name: string } | null;
  responsible?: { id: string; name: string } | null;
  contacts: { id: string; name: string; role?: string | null; phone?: string | null; email?: string | null }[];
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

export function OpportunityDialog({
  open,
  opportunityId,
  mode = "view",
  initialClientId,
  onClose,
  onSaved,
  refreshToken,
  onOpenClient,
  onOpenContact,
  onOpenActivity,
  onCreateActivity,
  onOpenNote,
  onCreateNote,
}: OpportunityDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(mode === "create");
  const [detail, setDetail] = useState<OpportunityDetail | null>(null);
  const [clients, setClients] = useState<Option[]>([]);
  const [contacts, setContacts] = useState<Option[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [stages, setStages] = useState<Option[]>([]);
  const [contactSelection, setContactSelection] = useState<Set<string>>(new Set());
  const [contactFilter, setContactFilter] = useState("");
  const [draft, setDraft] = useState({
    title: "",
    client_id: "",
    responsible_user_id: "",
    stage_id: "",
    value: "",
  });

  const isCreate = mode === "create";

  useEffect(() => {
    if (!open) return;
    const loadConfig = async () => {
      const [clientsRes, usersRes, stagesRes] = await Promise.all([
        fetch("/api/crm/clients", { cache: "no-store", credentials: "include" }),
        fetch("/api/crm/users", { cache: "no-store", credentials: "include" }),
        fetch("/api/crm/config?kind=opportunity-stages", { cache: "no-store", credentials: "include" }),
      ]);
      if (clientsRes.ok) {
        const data = await clientsRes.json();
        setClients(data?.clients || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers((data?.users || []).map((row: any) => ({ id: row.id, name: row.display_name || row.username })));
      }
      if (stagesRes.ok) {
        const data = await stagesRes.json();
        setStages(data?.items || []);
      }
    };
    loadConfig();
  }, [open]);

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
    if (!opportunityId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/opportunities/${opportunityId}`, { cache: "no-store", credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setDetail(data);
      setDraft({
        title: data?.opportunity?.title || "",
        client_id: data?.opportunity?.client_id || "",
        responsible_user_id: data?.opportunity?.responsible_user_id || "",
        stage_id: data?.opportunity?.stage_id || "",
        value: Number.isFinite(data?.opportunity?.value) ? String(data.opportunity.value) : "",
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
      setDraft({ title: "", client_id: initialClientId || "", responsible_user_id: "", stage_id: "", value: "" });
      setContactSelection(new Set());
      return;
    }
    loadDetail();
  }, [open, opportunityId, isCreate, initialClientId]);

  useEffect(() => {
    if (!open || isCreate) return;
    loadDetail();
  }, [refreshToken]);

  const handleSave = async () => {
    if (!draft.title.trim()) return;
    setSaving(true);
    try {
      const parsedValue = toNumber(draft.value);
      const payload = {
        title: draft.title.trim(),
        client_id: draft.client_id || null,
        responsible_user_id: draft.responsible_user_id || null,
        stage_id: draft.stage_id || null,
        value: Number.isFinite(parsedValue) ? parsedValue : null,
        contact_ids: Array.from(contactSelection),
      };
      const res = await fetch(isCreate ? "/api/crm/opportunities" : `/api/crm/opportunities/${opportunityId}`, {
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

    const notes = detail?.notes || [];
    const noteMap = new Map<string, (typeof notes)[0] & { replies: (typeof notes) }>();
    notes.forEach((note) => {
      noteMap.set(note.id, { ...note, replies: [] });
    });
    notes.forEach((note) => {
      if (note.parent_note_id && noteMap.has(note.parent_note_id)) {
        noteMap.get(note.parent_note_id)!.replies.push(note);
      }
    });

    const noteItems = notes
      .filter((note) => !note.parent_note_id)
      .map((note) => {
        const thread = noteMap.get(note.id)!;
        thread.replies.sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return aTime - bTime;
        });
        const threadDates = [thread.created_at, ...thread.replies.map((reply) => reply.created_at)].filter(
          Boolean
        ) as string[];
        const latestDate = threadDates.length ? threadDates.sort().slice(-1)[0] : "";
        return {
          id: thread.id,
          type: "note" as const,
          date: latestDate || thread.created_at || "",
          rootDate: thread.created_at || "",
          title: thread.author_name || "-",
          detail: thread.detail || "",
          replies: thread.replies,
        };
      });

    return [...activityItems, ...noteItems].sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      return bTime - aTime;
    });
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
          <DialogTitle>{isCreate ? "Nueva oportunidad" : detail?.opportunity?.title || "Oportunidad"}</DialogTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{detail?.opportunity?.created_at ? `Creada ${detail.opportunity.created_at.slice(0, 10)}` : ""}</span>
            {detail?.stage?.name ? <Badge variant="outline">{detail.stage.name}</Badge> : null}
          </div>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-slate-400">Cargando...</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <DetailSection title="Detalle de oportunidad">
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldRow label="Titulo" value={detail?.opportunity?.title} editing={editing}>
                    <Input
                      value={draft.title}
                      onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Titulo"
                    />
                  </FieldRow>
                  <FieldRow label="Etapa" value={detail?.stage?.name} editing={editing}>
                    <select
                      className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink shadow-sm"
                      value={draft.stage_id}
                      onChange={(event) => setDraft((prev) => ({ ...prev, stage_id: event.target.value }))}
                    >
                      <option value="">Sin etapa</option>
                      {stages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.name}
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
                  <FieldRow label="Valor" value={formatCurrency(detail?.opportunity?.value || 0)} editing={editing}>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="USD"
                      value={draft.value}
                      onChange={(event) => setDraft((prev) => ({ ...prev, value: event.target.value }))}
                    />
                  </FieldRow>
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
              <DetailSection title="Cronologia">
                <div className="flex items-center justify-between pb-2">
                  <p className="text-xs text-slate-400">{timeline.length} eventos</p>
                  <div className="flex gap-2">
                    {!isCreate ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onCreateActivity?.({
                            clientId: detail?.opportunity?.client_id || detail?.client?.id || null,
                          })
                        }
                      >
                        Nueva actividad
                      </Button>
                    ) : null}
                    {!isCreate && opportunityId ? (
                      <Button size="sm" variant="outline" onClick={() => onCreateNote?.({ opportunityId })}>
                        Nueva nota
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-3">
                  {timeline.map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className={`rounded-xl border border-line/70 border-l-4 px-3 py-2 text-xs text-slate-600 shadow-sm ${
                        item.type === "activity"
                          ? "border-l-sky-400 bg-sky-50/60"
                          : "border-l-amber-400 bg-amber-50/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-ink">
                          {item.type === "activity" ? item.title : item.title}
                        </span>
                        <span>{item.date ? formatDateTime(item.date) : "-"}</span>
                      </div>
                      {item.type === "activity" && item.subtitle ? (
                        <p className="mt-1 text-xs text-slate-400">{item.subtitle}</p>
                      ) : null}
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
                                  opportunityId: opportunityId || "",
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
                      {item.type === "note" && item.replies?.length ? (
                        <div className="mt-3 space-y-2 border-l border-line pl-3">
                          {item.replies.map((reply: any) => (
                            <div key={reply.id} className="text-xs text-slate-600">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-ink">{reply.author_name || "-"}</span>
                                <span>{reply.created_at ? formatDateTime(reply.created_at) : "-"}</span>
                              </div>
                              <p className="mt-1 text-sm text-slate-700">{reply.detail}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
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
              <Button onClick={handleSave} disabled={!draft.title.trim() || saving}>
                {saving ? "Guardando..." : "Crear"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing((prev) => !prev)}>
                {editing ? "Cancelar" : "Editar"}
              </Button>
              {editing ? (
                <Button onClick={handleSave} disabled={!draft.title.trim() || saving}>
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
