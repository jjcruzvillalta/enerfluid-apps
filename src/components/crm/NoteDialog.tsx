"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { DetailSection } from "@/components/crm/DetailSection";
import { FieldRow } from "@/components/crm/FieldRow";
import { formatDateTime } from "@/lib/data";

type NoteDialogProps = {
  open: boolean;
  noteId?: string | null;
  context?: {
    clientId?: string | null;
    contactId?: string | null;
    opportunityId?: string | null;
    activityId?: string | null;
  };
  parentNoteId?: string | null;
  parentPreview?: string | null;
  onClose: () => void;
  onSaved?: () => void;
};

type NoteDetail = {
  note: {
    id: string;
    detail: string;
    author_name?: string | null;
    created_at?: string | null;
  };
  parent?: { id: string; detail: string; author_name?: string | null; created_at?: string | null } | null;
  replies?: { id: string; detail: string; author_name?: string | null; created_at?: string | null }[];
  client?: { id: string; name: string } | null;
  contact?: { id: string; name: string } | null;
  opportunity?: { id: string; title: string } | null;
  activity?: { id: string; scheduled_at?: string | null } | null;
};

type UserOption = { id: string; username: string; display_name?: string | null };

export function NoteDialog({
  open,
  noteId,
  context,
  parentNoteId,
  parentPreview,
  onClose,
  onSaved,
}: NoteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<NoteDetail | null>(null);
  const [draft, setDraft] = useState({ detail: "" });
  const [users, setUsers] = useState<UserOption[]>([]);
  const [mention, setMention] = useState<{ start: number; end: number; query: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isEdit = Boolean(noteId);

  useEffect(() => {
    if (!open) return;
    if (!noteId) {
      setDetail(null);
      setDraft({ detail: "" });
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/crm/notes/${noteId}`, { cache: "no-store", credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setDetail(data);
        setDraft({ detail: data?.note?.detail || "" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, noteId]);

  useEffect(() => {
    if (!open) return;
    const loadUsers = async () => {
      const res = await fetch("/api/crm/users", { cache: "no-store", credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data?.users || []);
    };
    loadUsers();
  }, [open]);

  const canSave = useMemo(() => draft.detail.trim().length > 0, [draft.detail]);

  const mentionOptions = useMemo(() => {
    if (!mention) return [];
    const query = mention.query.toLowerCase();
    return users
      .filter((user) => {
        const name = (user.display_name || user.username || "").toLowerCase();
        const username = (user.username || "").toLowerCase();
        return name.includes(query) || username.includes(query);
      })
      .slice(0, 6);
  }, [mention, users]);

  const updateMentionState = (value: string, caret: number) => {
    const slice = value.slice(0, caret);
    const atIndex = slice.lastIndexOf("@");
    if (atIndex === -1) {
      setMention(null);
      return;
    }
    const query = slice.slice(atIndex + 1);
    if (query.includes(" ") || query.includes("\n")) {
      setMention(null);
      return;
    }
    setMention({ start: atIndex, end: caret, query });
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    const caret = event.target.selectionStart ?? value.length;
    setDraft({ detail: value });
    updateMentionState(value, caret);
  };

  const applyMention = (user: UserOption) => {
    if (!mention) return;
    const before = draft.detail.slice(0, mention.start);
    const after = draft.detail.slice(mention.end);
    const next = `${before}@${user.username} ${after}`;
    setDraft({ detail: next });
    setMention(null);
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      const caret = (before + `@${user.username} `).length;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(caret, caret);
    });
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        detail: draft.detail,
        client_id: context?.clientId || null,
        contact_id: context?.contactId || null,
        opportunity_id: context?.opportunityId || null,
        activity_id: context?.activityId || null,
        parent_note_id: parentNoteId || null,
      };
      const res = await fetch(noteId ? `/api/crm/notes/${noteId}` : "/api/crm/notes", {
        method: noteId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) return;
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="w-[95vw] max-w-2xl">
        <DialogClose asChild>
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full border border-line bg-white p-1 text-slate-500 shadow-sm hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogClose>
        <DialogHeader>
          <DialogTitle>{noteId ? "Detalle de nota" : parentNoteId ? "Responder nota" : "Nueva nota"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-slate-400">Cargando...</p>
        ) : (
          <div className="space-y-4">
            {parentPreview ? (
              <DetailSection title="Nota original">
                <p className="text-sm text-slate-700">{parentPreview}</p>
              </DetailSection>
            ) : null}

            <DetailSection title="Contenido">
              <FieldRow label="Detalle" editing>
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    className="min-h-[140px] w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                    value={draft.detail}
                    onChange={handleChange}
                    placeholder="Escribe la nota y menciona con @usuario"
                  />
                  {mention && mentionOptions.length ? (
                    <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-xl border border-line bg-white p-2 shadow-card">
                      {mentionOptions.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-slate-600 hover:bg-mist"
                          onClick={() => applyMention(user)}
                        >
                          <span className="font-semibold text-ink">@{user.username}</span>
                          <span>{user.display_name || "-"}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </FieldRow>
            </DetailSection>

            {detail ? (
              <DetailSection title="Contexto">
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldRow label="Cliente" value={detail?.client?.name || "-"} />
                  <FieldRow label="Contacto" value={detail?.contact?.name || "-"} />
                  <FieldRow label="Oportunidad" value={detail?.opportunity?.title || "-"} />
                  <FieldRow label="Actividad" value={detail?.activity?.scheduled_at ? formatDateTime(detail.activity.scheduled_at) : "-"} />
                </div>
              </DetailSection>
            ) : null}

            {detail?.replies?.length ? (
              <DetailSection title="Respuestas">
                <div className="space-y-2">
                  {detail.replies.map((reply) => (
                    <div key={reply.id} className="rounded-xl border border-line bg-white px-3 py-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-ink">{reply.author_name || "-"}</span>
                        <span>{reply.created_at ? reply.created_at.slice(0, 10) : "-"}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{reply.detail}</p>
                    </div>
                  ))}
                </div>
              </DetailSection>
            ) : null}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? "Guardando..." : noteId ? "Guardar" : "Crear"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
