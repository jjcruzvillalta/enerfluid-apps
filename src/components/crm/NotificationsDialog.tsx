"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type NotificationRow = {
  id: string;
  type: string;
  is_read: boolean;
  created_at?: string | null;
  note_id?: string | null;
  actor_name?: string | null;
  entity?: { type: string; id: string } | null;
  preview?: string | null;
};

type NotificationsDialogProps = {
  open: boolean;
  onClose: () => void;
  onNavigate?: (payload: { entity: { type: string; id: string } | null; noteId?: string | null }) => void;
};

export function NotificationsDialog({ open, onClose, onNavigate }: NotificationsDialogProps) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/notifications", { cache: "no-store", credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data?.notifications || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    load();
  }, [open]);

  const markRead = async (ids?: string[]) => {
    await fetch("/api/crm/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ids: ids || [] }),
    });
    await load();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="w-[95vw] max-w-2xl">
        <DialogClose asChild>
          <button
            type="button"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white/95 text-slate-500 shadow-soft transition hover:bg-white hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogClose>
        <DialogHeader className="flex items-center justify-between">
          <DialogTitle>Notificaciones</DialogTitle>
        </DialogHeader>

        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span>{loading ? "Cargando..." : `${notifications.length} notificaciones`}</span>
          {notifications.length ? (
            <Button size="sm" variant="outline" onClick={() => markRead()}>
              Marcar todas como leidas
            </Button>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          {notifications.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border px-3 py-2 text-xs ${
                item.is_read ? "border-line bg-white" : "border-accent/30 bg-accentSoft/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">{item.actor_name || "Sistema"}</span>
                <span className="text-slate-400">{item.created_at ? item.created_at.slice(0, 10) : "-"}</span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{item.preview || "Nueva notificacion"}</p>
              <div className="mt-2 flex gap-2">
                {item.entity ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate?.({ entity: item.entity, noteId: item.note_id })}
                  >
                    Ver en CRM
                  </Button>
                ) : null}
                {!item.is_read ? (
                  <Button size="sm" variant="ghost" onClick={() => markRead([item.id])}>
                    Marcar leida
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {!notifications.length && !loading ? (
            <p className="text-sm text-slate-400">Sin notificaciones.</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
