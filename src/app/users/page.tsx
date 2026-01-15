"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";

type RoleMap = Record<string, string>;

type UserRow = {
  id: string;
  username: string;
  display_name?: string | null;
  roles?: RoleMap;
};

const defaultRoles: RoleMap = {
  portal: "none",
  inventory: "none",
  crm: "none",
  users: "none",
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<{
    username: string;
    displayName: string;
    password: string;
    roles: RoleMap;
  }>({
    username: "",
    displayName: "",
    password: "",
    roles: { ...defaultRoles },
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data?.users || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const resetForm = () => {
    setForm({ username: "", displayName: "", password: "", roles: { ...defaultRoles } });
    setEditingId(null);
  };

  const handleSubmit = async () => {
    const payload = {
      username: form.username,
      displayName: form.displayName,
      password: form.password,
      roles: form.roles,
    };
    const res = await fetch(editingId ? `/api/users/${editingId}` : "/api/users", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      resetForm();
      setDialogOpen(false);
      loadUsers();
    }
  };

  const handleDelete = async (id: string) => {
    const confirmDelete = window.confirm("Eliminar usuario?");
    if (!confirmDelete) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) loadUsers();
  };

  const startEdit = (user: UserRow) => {
    setEditingId(user.id);
    setForm({
      username: user.username,
      displayName: user.display_name || "",
      password: "",
      roles: { ...defaultRoles, ...(user.roles || {}) },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Usuarios</h1>
          <p className="text-sm text-slate-500">Gestion de accesos y roles por app.</p>
        </div>
        <Button
          className="w-full md:w-auto"
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
        >
          Nuevo usuario
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Listado</h3>
          <span className="text-xs text-slate-400">{loading ? "Cargando..." : `${users.length} usuarios`}</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-mist text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Usuario</th>
                <th className="px-3 py-2 text-left">Nombre</th>
                <th className="px-3 py-2 text-left">Roles</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800">{row.username}</td>
                  <td className="px-3 py-2">{row.display_name}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(defaultRoles).map((appKey) => {
                        const value = row.roles?.[appKey] ?? "none";
                        return (
                          <span key={appKey} className="inline-flex rounded-full border px-2 py-0.5">
                            {appKey}:{value}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          startEdit(row);
                          setDialogOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(row.id)}>
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!users.length && !loading && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-400">
                    Sin usuarios
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="w-[96vw] max-w-2xl">
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
            <DialogTitle>{editingId ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
            <p className="text-sm text-slate-500">
              {editingId ? "Actualiza datos y roles del usuario." : "Completa los datos para crear un nuevo usuario."}
            </p>
          </DialogHeader>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input
              placeholder="Usuario"
              value={form.username}
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
            />
            <Input
              placeholder="Nombre visible"
              value={form.displayName}
              onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
            />
            <div className="md:col-span-2">
              <Input
                placeholder={editingId ? "Nueva clave (opcional)" : "Clave"}
                type="password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              />
              {editingId ? <p className="mt-1 text-xs text-slate-400">Deja en blanco para mantener la clave actual.</p> : null}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {Object.keys(defaultRoles).map((appKey) => (
              <label key={appKey} className="text-xs text-slate-600">
                {appKey}
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink shadow-sm"
                  value={form.roles[appKey]}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      roles: { ...prev.roles, [appKey]: event.target.value },
                    }))
                  }
                >
                  <option value="none">none</option>
                  <option value="standard">standard</option>
                  <option value="admin">admin</option>
                </select>
              </label>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>{editingId ? "Guardar cambios" : "Crear usuario"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
