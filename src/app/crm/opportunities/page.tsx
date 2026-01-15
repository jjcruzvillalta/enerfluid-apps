"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCrmDialogs } from "@/components/crm/useCrmDialogs";
import { formatCurrency, formatDateTime } from "@/lib/data";

type OpportunityRow = {
  id: string;
  title: string;
  stage_id?: string | null;
  stage_name?: string | null;
  client_name?: string | null;
  responsible_name?: string | null;
  contacts_count?: number;
  created_at?: string | null;
  value?: number | null;
  sort_order?: number | null;
};

type StageOption = { id: string; name: string };
type Option = { id: string; name: string };

const buildContainerId = (stageId: string) => `stage:${stageId}`;

const getStageKey = (stageId?: string | null) => stageId || "sin_etapa";

const getSortValue = (row?: OpportunityRow | null, fallback = 0) => {
  if (!row) return fallback;
  if (Number.isFinite(row.sort_order)) return Number(row.sort_order);
  if (row.created_at) {
    const parsed = new Date(row.created_at).getTime();
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const findColumnForItem = (columns: Record<string, string[]>, itemId: string) =>
  Object.keys(columns).find((key) => columns[key].includes(itemId));

function SortableOpportunityCard({
  row,
  onClick,
}: {
  row: OpportunityRow;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      type="button"
      className={`w-full rounded-2xl border border-line p-3 text-left transition hover:bg-mist ${isDragging ? "opacity-60" : ""}`}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      <p className="text-sm font-semibold text-slate-800">{row.title}</p>
      <p className="text-xs text-slate-500">{row.client_name || "-"}</p>
      <p className="text-xs text-slate-400">{row.responsible_name || "-"}</p>
      <p className="mt-1 text-xs font-semibold text-slate-600">{formatCurrency(row.value || 0)}</p>
    </button>
  );
}

function DragOverlayCard({ row }: { row: OpportunityRow }) {
  return (
    <div className="w-[280px] rounded-2xl border border-line bg-white p-3 text-left shadow-soft">
      <p className="text-sm font-semibold text-slate-800">{row.title}</p>
      <p className="text-xs text-slate-500">{row.client_name || "-"}</p>
      <p className="text-xs text-slate-400">{row.responsible_name || "-"}</p>
      <p className="mt-1 text-xs font-semibold text-slate-600">{formatCurrency(row.value || 0)}</p>
    </div>
  );
}

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [clients, setClients] = useState<Option[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [columns, setColumns] = useState<Record<string, string[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const columnsRef = useRef<Record<string, string[]>>({});
  const [filters, setFilters] = useState({
    q: "",
    stageId: "",
    clientId: "",
    responsibleId: "",
  });
  const { openOpportunity, createOpportunity, dialogs } = useCrmDialogs({
    onRefresh: () => setRefreshToken((prev) => prev + 1),
  });

  useEffect(() => {
    const loadConfig = async () => {
      const res = await fetch("/api/crm/config?kind=opportunity-stages", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setStages(data?.items || []);
    };
    loadConfig();
  }, []);

  useEffect(() => {
    const loadFilters = async () => {
      const [clientsRes, usersRes] = await Promise.all([
        fetch("/api/crm/clients", { cache: "no-store", credentials: "include" }),
        fetch("/api/crm/users", { cache: "no-store", credentials: "include" }),
      ]);
      if (clientsRes.ok) {
        const data = await clientsRes.json();
        setClients(data?.clients || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers((data?.users || []).map((row: any) => ({ id: row.id, name: row.display_name || row.username })));
      }
    };
    loadFilters();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.q) params.set("q", filters.q);
        if (filters.stageId) params.set("stageId", filters.stageId);
        if (filters.clientId) params.set("clientId", filters.clientId);
        if (filters.responsibleId) params.set("responsibleId", filters.responsibleId);
        const res = await fetch(`/api/crm/opportunities?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        setOpportunities(data?.opportunities || []);
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

  const stageOrder = useMemo(() => stages.map((stage) => stage.id), [stages]);
  const stageNameMap = useMemo(() => new Map(stages.map((stage) => [stage.id, stage.name])), [stages]);
  const opportunityMap = useMemo(() => new Map(opportunities.map((row) => [row.id, row])), [opportunities]);

  const stageList = useMemo(() => {
    const list = stageOrder.map((id) => ({ id, name: stageNameMap.get(id) || "" }));
    list.push({ id: "sin_etapa", name: "Sin etapa" });
    return list;
  }, [stageOrder, stageNameMap]);

  useEffect(() => {
    const nextColumns: Record<string, string[]> = {};
    stageList.forEach((stage) => {
      nextColumns[stage.id] = [];
    });
    opportunities.forEach((row) => {
      const stageId = getStageKey(row.stage_id);
      if (!nextColumns[stageId]) nextColumns[stageId] = [];
      nextColumns[stageId].push(row.id);
    });
    Object.keys(nextColumns).forEach((stageId) => {
      nextColumns[stageId].sort((a, b) => {
        const rowA = opportunityMap.get(a);
        const rowB = opportunityMap.get(b);
        const sortA = getSortValue(rowA, 0);
        const sortB = getSortValue(rowB, 0);
        if (sortA === sortB) {
          const timeA = rowA?.created_at ? new Date(rowA.created_at).getTime() : 0;
          const timeB = rowB?.created_at ? new Date(rowB.created_at).getTime() : 0;
          return timeB - timeA;
        }
        return sortA - sortB;
      });
    });
    setColumns(nextColumns);
  }, [opportunities, stageList, opportunityMap]);

  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeIdValue = String(active.id);
    const overIdValue = String(over.id);
    const activeColumn = findColumnForItem(columnsRef.current, activeIdValue);
    const overColumn = overIdValue.startsWith("stage:")
      ? overIdValue.replace("stage:", "")
      : findColumnForItem(columnsRef.current, overIdValue);
    if (!activeColumn || !overColumn) return;

    if (activeColumn === overColumn) {
      const items = columnsRef.current[activeColumn];
      const oldIndex = items.indexOf(activeIdValue);
      const newIndex = overIdValue.startsWith("stage:")
        ? items.length - 1
        : items.indexOf(overIdValue);
      if (oldIndex !== newIndex && newIndex >= 0) {
        setColumns((prev) => {
          const next = {
            ...prev,
            [activeColumn]: arrayMove(prev[activeColumn], oldIndex, newIndex),
          };
          columnsRef.current = next;
          return next;
        });
      }
      return;
    }

    setColumns((prev) => {
      const next = { ...prev };
      const sourceItems = [...(next[activeColumn] || [])];
      const targetItems = [...(next[overColumn] || [])];
      const sourceIndex = sourceItems.indexOf(activeIdValue);
      if (sourceIndex === -1) return prev;
      sourceItems.splice(sourceIndex, 1);
      const targetIndex = overIdValue.startsWith("stage:")
        ? targetItems.length
        : targetItems.indexOf(overIdValue);
      const insertAt = targetIndex >= 0 ? targetIndex : targetItems.length;
      targetItems.splice(insertAt, 0, activeIdValue);
      next[activeColumn] = sourceItems;
      next[overColumn] = targetItems;
      columnsRef.current = next;
      return next;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const activeIdValue = String(active.id);
    const overIdValue = String(over.id);
    const activeColumn = findColumnForItem(columnsRef.current, activeIdValue);
    const overColumn = overIdValue.startsWith("stage:")
      ? overIdValue.replace("stage:", "")
      : findColumnForItem(columnsRef.current, overIdValue);
    if (!activeColumn || !overColumn) return;

    const targetItems = columnsRef.current[overColumn] || [];
    const targetIndex = targetItems.indexOf(activeIdValue);
    if (targetIndex === -1) return;

    const prevId = targetIndex > 0 ? targetItems[targetIndex - 1] : null;
    const nextId = targetIndex < targetItems.length - 1 ? targetItems[targetIndex + 1] : null;
    const prevOrder = prevId ? getSortValue(opportunityMap.get(prevId)) : null;
    const nextOrder = nextId ? getSortValue(opportunityMap.get(nextId)) : null;
    let newOrder = Date.now();
    if (prevOrder !== null && nextOrder !== null) newOrder = (prevOrder + nextOrder) / 2;
    else if (prevOrder !== null) newOrder = prevOrder + 1;
    else if (nextOrder !== null) newOrder = nextOrder - 1;

    const nextStageId = overColumn === "sin_etapa" ? null : overColumn;
    const stageName = nextStageId ? stageNameMap.get(nextStageId) || "-" : "Sin etapa";

    setOpportunities((prev) =>
      prev.map((row) =>
        row.id === activeIdValue
          ? { ...row, stage_id: nextStageId, stage_name: stageName, sort_order: newOrder }
          : row
      )
    );

    await fetch(`/api/crm/opportunities/${activeIdValue}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ stage_id: nextStageId, sort_order: newOrder }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Oportunidades</h1>
          <p className="text-sm text-slate-500">Pipeline comercial por etapa.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-line bg-white p-1">
            <button
              type="button"
              className={`rounded-lg px-3 py-1 text-xs font-semibold ${view === "kanban" ? "bg-ink text-white" : "text-slate-500"}`}
              onClick={() => setView("kanban")}
            >
              Kanban
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1 text-xs font-semibold ${view === "table" ? "bg-ink text-white" : "text-slate-500"}`}
              onClick={() => setView("table")}
            >
              Tabla
            </button>
          </div>
          <Button onClick={() => createOpportunity()}>Nueva oportunidad</Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            placeholder="Buscar oportunidad"
            value={filters.q}
            onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
          />
          <select
            className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink shadow-sm"
            value={filters.stageId}
            onChange={(event) => setFilters((prev) => ({ ...prev, stageId: event.target.value }))}
          >
            <option value="">Etapa</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
            <option value="sin_etapa">Sin etapa</option>
          </select>
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
          <select
            className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink shadow-sm"
            value={filters.responsibleId}
            onChange={(event) => setFilters((prev) => ({ ...prev, responsibleId: event.target.value }))}
          >
            <option value="">Responsable</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {view === "kanban" ? (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="flex min-w-max gap-4 pb-2">
              {stageList.map((stage) => {
                const stageIds = columns[stage.id] || [];
                const totalValue = stageIds.reduce((sum, id) => sum + (opportunityMap.get(id)?.value || 0), 0);
                return (
                  <OpportunityColumn
                    key={stage.id}
                    stageId={stage.id}
                    title={stage.name}
                    count={stageIds.length}
                    totalValue={totalValue}
                  >
                    <SortableContext items={stageIds} strategy={verticalListSortingStrategy}>
                      <div className="mt-4 min-h-[80px] space-y-3">
                        {stageIds.map((id) => {
                          const row = opportunityMap.get(id);
                          if (!row) return null;
                          return (
                            <SortableOpportunityCard key={row.id} row={row} onClick={() => openOpportunity(row.id)} />
                          );
                        })}
                        {!stageIds.length && !loading && (
                          <p className="text-xs text-slate-400">Sin oportunidades.</p>
                        )}
                      </div>
                    </SortableContext>
                  </OpportunityColumn>
                );
              })}
            </div>
          </div>
          <DragOverlay>
            {activeId ? (() => {
              const row = opportunityMap.get(activeId);
              return row ? <DragOverlayCard row={row} /> : null;
            })() : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <Card className="p-4">
          <div className="flex items-center justify-between pb-3 text-xs text-slate-400">
            <span>{loading ? "Cargando..." : `${opportunities.length} oportunidades`}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-mist text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Oportunidad</th>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">Etapa</th>
                  <th className="px-3 py-2 text-left">Responsable</th>
                  <th className="px-3 py-2 text-left">Contactos</th>
                  <th className="px-3 py-2 text-left">Valor</th>
                  <th className="px-3 py-2 text-left">Creada</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-t border-slate-100 hover:bg-mist/50"
                    onClick={() => openOpportunity(row.id)}
                  >
                    <td className="px-3 py-2 font-medium text-slate-800">{row.title}</td>
                    <td className="px-3 py-2">{row.client_name || "-"}</td>
                    <td className="px-3 py-2">{row.stage_name || "-"}</td>
                    <td className="px-3 py-2">{row.responsible_name || "-"}</td>
                    <td className="px-3 py-2">{row.contacts_count ?? 0}</td>
                    <td className="px-3 py-2">{formatCurrency(row.value || 0)}</td>
                    <td className="px-3 py-2">{row.created_at ? formatDateTime(row.created_at) : "-"}</td>
                  </tr>
                ))}
                {!opportunities.length && !loading && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-400">
                      Sin oportunidades.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {dialogs}
    </div>
  );
}

function OpportunityColumn({
  stageId,
  title,
  count,
  totalValue,
  children,
}: {
  stageId: string;
  title: string;
  count: number;
  totalValue: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: buildContainerId(stageId) });
  return (
    <Card
      ref={setNodeRef}
      className={`w-[280px] shrink-0 p-4 ${isOver ? "ring-2 ring-accent/40" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
          <p className="text-xs text-slate-400">{formatCurrency(totalValue)}</p>
        </div>
        <span className="text-xs text-slate-400">{count}</span>
      </div>
      {children}
    </Card>
  );
}
