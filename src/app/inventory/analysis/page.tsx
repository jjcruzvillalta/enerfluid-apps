
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useInventory } from "@/context/InventoryContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChartWrap } from "@/components/inventory/ChartWrap";
import { CustomerLegend } from "@/components/inventory/CustomerLegend";
import { ItemDetailDialog } from "@/components/inventory/ItemDetailDialog";
import { cn } from "@/lib/utils";
import { Bar, Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  TimeScale,
  Tooltip,
  type ChartOptions,
  type ChartDataset,
} from "chart.js";
import "chartjs-adapter-date-fns";
import {
  buildCatalogLookup,
  buildCatalogShare,
  buildLineDistribution,
  buildPoints,
  buildSalesByCatalogData,
  buildSeriesForItems,
  buildTopCustomersByYearData,
  formatCurrency,
  formatDate,
  formatNumber,
  formatTick,
  getMovementSign,
  getRowsDateRange,
  getTimeUnit,
  normalizeText,
  palette,
} from "@/lib/data";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  TimeScale,
  Tooltip
);

const pieLabelPlugin = {
  id: "pieLabelPlugin",
  afterDatasetsDraw(chart, _args, pluginOptions) {
    const chartType = chart.config.type;
    if (chartType !== "pie" && chartType !== "doughnut") return;
    const dataset = chart.data.datasets?.[0];
    if (!dataset) return;
    const total = dataset.data.reduce((sum, value) => {
      const num = Number(value);
      return Number.isFinite(num) ? sum + num : sum;
    }, 0);
    if (!total) return;
    const meta = chart.getDatasetMeta(0);
    const ctx = chart.ctx;
    const minPercent = pluginOptions?.minPercent ?? 7;
    const fontSize = pluginOptions?.fontSize ?? 11;
    ctx.save();
    ctx.fillStyle = pluginOptions?.color || "#ffffff";
    ctx.font = `600 ${fontSize}px "Manrope", "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    meta.data.forEach((arc, index) => {
      const value = Number(dataset.data[index] || 0);
      if (!Number.isFinite(value) || value <= 0) return;
      const percent = (value / total) * 100;
      if (percent < minPercent) return;
      const pos = arc.tooltipPosition();
      ctx.fillText(`${percent.toFixed(1)}%`, pos.x, pos.y);
    });
    ctx.restore();
  },
};

const parseDateInput = (value, endOfDay = false) => {
  if (!value) return null;
  const suffix = endOfDay ? "T23:59:59" : "T00:00:00";
  return new Date(`${value}${suffix}`);
};

const getSelectedSet = (itemsIndex, selection) => {
  if (!itemsIndex) return null;
  if (!selection || selection.size === itemsIndex.items.length) return null;
  return selection;
};

const buildLineOptions = (period, labelFormatter): ChartOptions<"line"> => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: {
      labels: {
        color: "#0f172a",
        usePointStyle: true,
      },
    },
    tooltip: {
      callbacks: {
        title(items) {
          if (!items.length) return "";
          return new Date(items[0].parsed.x).toLocaleDateString("es-EC");
        },
        label(context) {
          return labelFormatter(context.parsed.y);
        },
      },
    },
  },
  scales: {
    x: {
      type: "time",
      time: { unit: getTimeUnit(period) },
      ticks: {
        color: "#64748b",
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 8,
        font: { size: 11 },
        callback: (value) => formatTick(value, period),
      },
      grid: { color: "rgba(15, 23, 42, 0.08)" },
    },
    y: {
      ticks: { color: "#64748b", font: { size: 11 } },
      grid: { color: "rgba(15, 23, 42, 0.08)" },
    },
  },
});

const pieOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 650 },
  layout: { padding: 8 },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label(context) {
          const value = context.parsed || 0;
          return `${context.label}: ${formatCurrency(value)}`;
        },
      },
    },
    pieLabelPlugin: { minPercent: 6, fontSize: 11 },
  },
};

const buildStackedBarOptions = (legendTotals?: Map<string, number> | null): ChartOptions<"bar"> => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        color: "#0f172a",
        usePointStyle: true,
        ...(legendTotals
          ? {
              generateLabels(chart) {
                const base = ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
                const unique = new Map();
                base.forEach((item) => {
                  if (!unique.has(item.text)) unique.set(item.text, item);
                });
                return Array.from(unique.values()).sort(
                  (a, b) => (legendTotals.get(b.text) || 0) - (legendTotals.get(a.text) || 0)
                );
              },
            }
          : null),
      },
    },
    tooltip: {
      callbacks: {
        label(context) {
          return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
        },
      },
    },
  },
  scales: {
    x: {
      stacked: true,
      ticks: { color: "#64748b", font: { size: 11 } },
      grid: { color: "rgba(15, 23, 42, 0.08)" },
    },
    y: {
      stacked: true,
      ticks: { color: "#64748b", font: { size: 11 } },
      grid: { color: "rgba(15, 23, 42, 0.08)" },
    },
  },
});

type CustomerByYearDataset = ChartDataset<"bar"> & { customerByYear?: Record<string, string> };

const customerStackedOptions: ChartOptions<"bar"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label(context) {
          const year = String(context.label ?? "");
          const dataset = context.dataset as CustomerByYearDataset;
          const customer = dataset.customerByYear?.[year];
          const label = customer || dataset.label;
          return `${label}: ${formatCurrency(context.parsed.y)}`;
        },
      },
    },
  },
  scales: {
    x: {
      stacked: true,
      ticks: { color: "#64748b", font: { size: 11 } },
      grid: { color: "rgba(15, 23, 42, 0.08)" },
    },
    y: {
      stacked: true,
      ticks: { color: "#64748b", font: { size: 11 } },
      grid: { color: "rgba(15, 23, 42, 0.08)" },
    },
  },
};

export default function AnalysisPage() {
  const {
    movements,
    ventas,
    itemsIndex,
    catalogIndex,
    selection,
    setSelection,
    itemFilter,
    setItemFilter,
  } = useInventory();

  const [inventoryPeriod, setInventoryPeriod] = useState("month");
  const [inventoryStartDate, setInventoryStartDate] = useState("");
  const [inventoryEndDate, setInventoryEndDate] = useState("");
  const [movementStartDate, setMovementStartDate] = useState("");
  const [movementEndDate, setMovementEndDate] = useState("");
  const [showIngresos, setShowIngresos] = useState(true);
  const [showEgresos, setShowEgresos] = useState(true);
  const [movementLimit, setMovementLimit] = useState(100);
  const [itemsTableLimit, setItemsTableLimit] = useState(200);
  const [motSelection, setMotSelection] = useState<Set<string>>(new Set());
  const [itemModal, setItemModal] = useState({ open: false, item: null });

  const selectedSet = useMemo(() => getSelectedSet(itemsIndex, selection), [itemsIndex, selection]);

  const inventoryRange = useMemo(
    () => ({
      startDate: parseDateInput(inventoryStartDate),
      endDate: parseDateInput(inventoryEndDate, true),
    }),
    [inventoryStartDate, inventoryEndDate]
  );

  const movementRange = useMemo(
    () => ({
      startDate: parseDateInput(movementStartDate),
      endDate: parseDateInput(movementEndDate, true),
    }),
    [movementStartDate, movementEndDate]
  );

  const inventorySeries = useMemo(
    () =>
      buildSeriesForItems({
        movements,
        period: inventoryPeriod,
        ...inventoryRange,
        itemsSet: selectedSet || null,
      }),
    [movements, inventoryPeriod, inventoryRange, selectedSet]
  );

  const lineDistribution = useMemo(
    () => buildLineDistribution(itemsIndex, selectedSet),
    [itemsIndex, selectedSet]
  );

  const catalogShare = useMemo(
    () => buildCatalogShare(itemsIndex, selectedSet),
    [itemsIndex, selectedSet]
  );

  const catalogLookup = useMemo(
    () => buildCatalogLookup(itemsIndex, catalogIndex),
    [itemsIndex, catalogIndex]
  );

  const salesByCustomerData = useMemo(() => {
    if (!ventas?.length) return null;
    const rows = selectedSet ? ventas.filter((row) => selectedSet.has(row.item)) : ventas.slice();
    return buildTopCustomersByYearData(rows, 10, 10);
  }, [ventas, selectedSet]);

  const salesByCatalogData = useMemo(() => {
    if (!ventas?.length) return null;
    const rows = selectedSet ? ventas.filter((row) => selectedSet.has(row.item)) : ventas.slice();
    return buildSalesByCatalogData(rows, catalogLookup);
  }, [ventas, selectedSet, catalogLookup]);

  const motives = useMemo((): string[] => {
    const set = new Set<string>();
    movements.forEach((row) => {
      if (row.mot !== undefined) set.add(String(row.mot || ""));
    });
    return Array.from(set).sort();
  }, [movements]);

  const filteredItems = useMemo(() => {
    if (!itemsIndex) return [];
    const query = normalizeText(itemFilter);
    const terms = query ? query.split(/\s+/).filter(Boolean) : [];
    return itemsIndex.items.filter((item) => {
      if (!terms.length) return true;
      const haystack = `${item.code} ${item.desc} ${item.brand}`;
      const normalized = normalizeText(haystack);
      return terms.every((term) => normalized.includes(term));
    });
  }, [itemsIndex, itemFilter]);

  const itemCountLabel = useMemo(() => {
    if (!itemsIndex) return "-";
    const total = itemsIndex.items.length;
    const selected = selection?.size ?? 0;
    const catalogTotal = itemsIndex.items.filter((item) => item.isCatalog).length;
    return `${selected}/${total} (catalogo ${catalogTotal})`;
  }, [itemsIndex, selection]);

  const itemsTableRows = useMemo(() => {
    if (!itemsIndex) return [];
    return itemsIndex.items
      .filter((item) => (!selectedSet || selectedSet.has(item.code)))
      .map((item) => ({
        ...item,
        costTotal: Number.isFinite(item.stock) && Number.isFinite(item.cost) ? item.stock * item.cost : 0,
      }))
      .sort((a, b) => b.costTotal - a.costTotal);
  }, [itemsIndex, selectedSet]);

  const visibleItemsTableRows = useMemo(
    () => itemsTableRows.slice(0, itemsTableLimit),
    [itemsTableRows, itemsTableLimit]
  );

  const movementRows = useMemo(() => {
    let rows = movements.slice();
    if (selectedSet) rows = rows.filter((row) => selectedSet.has(row.item));
    if (movementRange.startDate) rows = rows.filter((row) => row.date >= movementRange.startDate);
    if (movementRange.endDate) rows = rows.filter((row) => row.date <= movementRange.endDate);
    if (motSelection.size && motSelection.size !== motives.length) {
      rows = rows.filter((row) => motSelection.has(row.mot || ""));
    }
    rows = rows.filter((row) => {
      const sign = getMovementSign(row);
      if (sign > 0 && !showIngresos) return false;
      if (sign < 0 && !showEgresos) return false;
      return true;
    });
    return rows.sort((a, b) => b.date - a.date);
  }, [movements, selectedSet, movementRange, motSelection, motives, showIngresos, showEgresos]);

  const visibleMovements = useMemo(
    () => movementRows.slice(0, movementLimit),
    [movementRows, movementLimit]
  );

  const catalogMissing = useMemo(() => {
    if (!catalogIndex || !itemsIndex) return [];
    const itemsSet = new Set(itemsIndex.items.map((item) => item.code));
    return Array.from(catalogIndex.keys()).filter((code) => !itemsSet.has(code));
  }, [catalogIndex, itemsIndex]);

  const latestRangeLabel = useMemo(() => {
    if (!inventorySeries) return "Rango: -";
    return `Rango: ${inventorySeries.startDate ? formatDate(inventorySeries.startDate) : "-"} a ${
      inventorySeries.endDate ? formatDate(inventorySeries.endDate) : "-"
    }`;
  }, [inventorySeries]);

  const unitsChartData = inventorySeries
    ? {
        datasets: [
          {
            label: "Unidades",
            data: buildPoints(inventorySeries.dates, inventorySeries.unitsSeries),
            borderColor: "#1f6feb",
            backgroundColor: "rgba(31, 111, 235, 0.18)",
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 2,
          },
        ],
      }
    : null;

  const valueChartData = inventorySeries
    ? {
        datasets: [
          {
            label: "Valor (USD)",
            data: buildPoints(inventorySeries.dates, inventorySeries.valueSeries),
            borderColor: "#60a5fa",
            backgroundColor: "rgba(96, 165, 250, 0.18)",
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 2,
          },
        ],
      }
    : null;

  const linePieData = lineDistribution
    ? {
        labels: lineDistribution.map((d) => d[0]),
        datasets: [
          {
            data: lineDistribution.map((d) => d[1]),
            backgroundColor: lineDistribution.map((_row, idx) => palette[idx % palette.length]),
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.95)",
            hoverOffset: 10,
            borderRadius: 4,
          },
        ],
      }
    : null;

  const catalogPieData = catalogShare
    ? {
        labels: catalogShare.labels,
        datasets: [
          {
            data: catalogShare.values,
            backgroundColor: catalogShare.labels.map((_row, idx) => palette[idx % palette.length]),
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.95)",
            hoverOffset: 10,
            borderRadius: 4,
          },
        ],
      }
    : null;

  useEffect(() => {
    if (!movements.length) return;
    const range = getRowsDateRange(movements);
    if (!range) return;
    setInventoryStartDate((prev) => prev || formatDate(range.minDate));
    setInventoryEndDate((prev) => prev || formatDate(range.maxDate));
    setMovementStartDate((prev) => prev || formatDate(range.minDate));
    setMovementEndDate((prev) => prev || formatDate(range.maxDate));
  }, [movements]);

  useEffect(() => {
    if (!motives.length) return;
    setMotSelection(new Set(motives));
  }, [motives]);

  useEffect(() => {
    setItemsTableLimit(200);
  }, [itemsTableRows.length]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Seleccion de items</CardTitle>
            <CardDescription>Busca por codigo, descripcion o marca. Seleccion multiple disponible.</CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-500">
              <span className="uppercase tracking-[0.18em] text-[10px] text-slate-400">Items activos</span>
              <span className="font-semibold text-slate-700">{itemCountLabel}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  if (!itemsIndex) return;
                  const codes = filteredItems.map((item) => item.code);
                  setSelection((prev) => {
                    const next = new Set(prev);
                    codes.forEach((code) => next.add(code));
                    return next;
                  });
                }}
              >
                Seleccionar filtrados
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  if (!itemsIndex) return;
                  const codes = filteredItems.map((item) => item.code);
                  setSelection((prev) => {
                    const next = new Set(prev);
                    codes.forEach((code) => next.delete(code));
                    return next;
                  });
                }}
              >
                Deseleccionar filtrados
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  if (!itemsIndex) return;
                  setSelection(new Set(itemsIndex.items.map((item) => item.code)));
                }}
              >
                Todos
              </Button>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => setSelection(new Set())}>
                Ninguno
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block text-sm text-slate-600">
            Buscar item
            <Input
              value={itemFilter}
              onChange={(event) => setItemFilter(event.target.value)}
              placeholder="Ej: 0101 o filtro o marca"
            />
          </label>
          <div className="max-h-72 overflow-auto rounded-2xl border border-line bg-white">
            <div className="space-y-2 p-3">
              {filteredItems.map((item) => (
                <label
                  key={item.code}
                  className={cn(
                    "flex items-start gap-2 rounded-xl px-3 py-2 text-sm",
                    item.isCatalog ? "bg-emerald-50" : "bg-slate-100"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selection.has(item.code)}
                    onChange={(event) => {
                      setSelection((prev) => {
                        const next = new Set(prev);
                        if (event.target.checked) next.add(item.code);
                        else next.delete(item.code);
                        return next;
                      });
                    }}
                  />
                  <span>
                    {item.code} - {item.desc} ({item.brand})
                  </span>
                </label>
              ))}
              {!filteredItems.length && <div className="text-sm text-slate-400">Sin items para el filtro.</div>}
            </div>
          </div>
          {catalogMissing.length ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
              Advertencia: {catalogMissing.length} codigos del catalogo no existen en el listado de items.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Distribucion de inventario</CardTitle>
          <CardDescription>Valor actual del inventario por linea y por catalogo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <ChartWrap title="Por linea" empty={!linePieData}>
            {linePieData && <Pie data={linePieData} options={pieOptions} plugins={[pieLabelPlugin]} />}
          </ChartWrap>
          <ChartWrap title="Catalogo VS No catalogo" empty={!catalogPieData}>
            {catalogPieData && <Pie data={catalogPieData} options={pieOptions} plugins={[pieLabelPlugin]} />}
          </ChartWrap>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Items en inventario</CardTitle>
            <CardDescription>Ordenado por valor total (costo actual).</CardDescription>
          </div>
          <div className="text-sm text-slate-500">Items {itemsTableRows.length}</div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[420px] overflow-auto rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-mist text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Codigo</th>
                  <th className="px-3 py-2 text-left">Descripcion</th>
                  <th className="px-3 py-2 text-left">Marca</th>
                  <th className="px-3 py-2 text-left">Stock</th>
                  <th className="px-3 py-2 text-left">Costo unit.</th>
                  <th className="px-3 py-2 text-left">Costo total</th>
                  <th className="px-3 py-2 text-left">PVP actual</th>
                </tr>
              </thead>
              <tbody>
                {visibleItemsTableRows.map((item) => (
                  <tr
                    key={item.code}
                    className="cursor-pointer border-t border-slate-100 hover:bg-mist"
                    onClick={() => setItemModal({ open: true, item })}
                  >
                    <td className="px-3 py-2">{item.code}</td>
                    <td className="px-3 py-2">{item.desc || "-"}</td>
                    <td className="px-3 py-2">{item.brand || "-"}</td>
                    <td className="px-3 py-2">{formatNumber(item.stock)}</td>
                    <td className="px-3 py-2">{formatCurrency(item.cost)}</td>
                    <td className="px-3 py-2">{formatCurrency(item.costTotal)}</td>
                    <td className="px-3 py-2">{Number.isFinite(item.pvp) ? formatCurrency(item.pvp) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!itemsTableRows.length && (
            <p className="mt-3 text-sm text-slate-400">Sin items para los filtros actuales.</p>
          )}
          {itemsTableRows.length > visibleItemsTableRows.length && (
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>
                Mostrando {visibleItemsTableRows.length} de {itemsTableRows.length} items
              </span>
              <Button size="sm" variant="outline" onClick={() => setItemsTableLimit((prev) => prev + 200)}>
                Ver mas
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Evolucion del inventario</CardTitle>
              <CardDescription>{latestRangeLabel}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div>
                <div className="text-slate-400">Valor ultimo punto</div>
                <div className="font-semibold text-slate-700">
                  {inventorySeries ? formatCurrency(inventorySeries.lastValue) : "-"}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Unidades ultimo punto</div>
                <div className="font-semibold text-slate-700">
                  {inventorySeries ? Number(inventorySeries.lastUnits).toLocaleString("es-EC") : "-"}
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[160px_220px_220px]">
            <label className="text-xs text-slate-600">
              Agregacion
              <select
                className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink shadow-sm"
                value={inventoryPeriod}
                onChange={(event) => setInventoryPeriod(event.target.value)}
              >
                <option value="day">Dia</option>
                <option value="week">Semana</option>
                <option value="month">Mes</option>
                <option value="year">Ano</option>
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Desde
              <Input type="date" value={inventoryStartDate} onChange={(event) => setInventoryStartDate(event.target.value)} />
            </label>
            <label className="text-xs text-slate-600">
              Hasta
              <Input type="date" value={inventoryEndDate} onChange={(event) => setInventoryEndDate(event.target.value)} />
            </label>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <ChartWrap title="Unidades" empty={!unitsChartData}>
            {unitsChartData && (
              <Line data={unitsChartData} options={buildLineOptions(inventoryPeriod, (v) => formatNumber(v))} />
            )}
          </ChartWrap>
          <ChartWrap title="Valor en USD" empty={!valueChartData}>
            {valueChartData && (
              <Line data={valueChartData} options={buildLineOptions(inventoryPeriod, (v) => formatCurrency(v))} />
            )}
          </ChartWrap>
        </CardContent>
        <CardContent>
          <p className="text-xs text-slate-400">
            El valor se calcula con el costo historico del movimiento (Total o CXUnidad).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Movimientos recientes</CardTitle>
            <CardDescription>Incluye ingresos y egresos para los items seleccionados.</CardDescription>
          </div>
          <div className="flex gap-4 text-sm">
            <div>
              <div className="text-slate-400">Registros</div>
              <div className="font-semibold text-slate-700">{movementRows.length}</div>
            </div>
            <div>
              <div className="text-slate-400">Mostrando</div>
              <div className="font-semibold text-slate-700">{visibleMovements.length}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={showIngresos} onChange={(event) => setShowIngresos(event.target.checked)} />
              Ingresos
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={showEgresos} onChange={(event) => setShowEgresos(event.target.checked)} />
              Egresos
            </label>
            <label className="text-xs text-slate-600">
              Desde
              <Input type="date" value={movementStartDate} onChange={(event) => setMovementStartDate(event.target.value)} />
            </label>
            <label className="text-xs text-slate-600">
              Hasta
              <Input type="date" value={movementEndDate} onChange={(event) => setMovementEndDate(event.target.value)} />
            </label>
          </div>
          <div className="rounded-2xl border border-line p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold">Motivos</span>
              <Button size="sm" variant="ghost" onClick={() => setMotSelection(new Set(motives))}>
                Todos
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMotSelection(new Set())}>
                Ninguno
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-3">
              {motives.map((mot) => (
                <label key={mot || "(vacio)"} className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={motSelection.has(mot)}
                    onChange={(event) => {
                      setMotSelection((prev) => {
                        const next = new Set(prev);
                        if (event.target.checked) next.add(mot);
                        else next.delete(mot);
                        return next;
                      });
                    }}
                  />
                  {mot || "(Sin motivo)"}
                </label>
              ))}
            </div>
          </div>
          <div className="max-h-[380px] overflow-auto rounded-2xl border border-line">
            <table className="w-full text-xs">
              <thead className="bg-mist text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-left">Descripcion</th>
                  <th className="px-3 py-2 text-left">Cantidad</th>
                  <th className="px-3 py-2 text-left">Costo unit.</th>
                  <th className="px-3 py-2 text-left">Costo total</th>
                  <th className="px-3 py-2 text-left">PVP unit.</th>
                  <th className="px-3 py-2 text-left">PVP total</th>
                  <th className="px-3 py-2 text-left">Motivo</th>
                  <th className="px-3 py-2 text-left">Referencia</th>
                  <th className="px-3 py-2 text-left">Origen/Destino</th>
                </tr>
              </thead>
              <tbody>
                {visibleMovements.map((row, idx) => (
                  <tr key={`${row.item}-${idx}`} className="border-t border-slate-100">
                    <td className="px-3 py-2">{row.date.toLocaleString("es-EC")}</td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className={getMovementSign(row) > 0 ? "text-emerald-600" : "text-rose-500"}
                      >
                        {getMovementSign(row) > 0 ? "Ingreso" : "Egreso"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{row.item}</td>
                    <td className="px-3 py-2">{row.desc || "-"}</td>
                    <td className="px-3 py-2">{formatNumber(row.qty)}</td>
                    <td className="px-3 py-2">{formatCurrency(row.cxUnit)}</td>
                    <td className="px-3 py-2">{formatCurrency(row.total)}</td>
                    <td className="px-3 py-2">
                      {Number.isFinite(row.pvpTotal) && Number.isFinite(row.qty)
                        ? formatCurrency(Math.abs(row.pvpTotal) / Math.abs(row.qty))
                        : "-"}
                    </td>
                    <td className="px-3 py-2">{formatCurrency(row.pvpTotal)}</td>
                    <td className="px-3 py-2">{row.mot || "-"}</td>
                    <td className="px-3 py-2">{row.referencia || "-"}</td>
                    <td className="px-3 py-2">{row.persona || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {movementRows.length > visibleMovements.length && (
            <Button variant="outline" onClick={() => setMovementLimit((prev) => prev + 100)}>
              Ver mas
            </Button>
          )}
          {!movementRows.length && <p className="text-sm text-slate-400">Sin movimientos para los filtros actuales.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ventas por cliente</CardTitle>
          <CardDescription>
            Top 10 clientes por anio (ordenados de mayor a menor). El resto se agrupa en &quot;Otros&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            {salesByCustomerData ? (
              <Bar data={salesByCustomerData} options={customerStackedOptions} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Sin datos de ventas para graficar.
              </div>
            )}
          </div>
          <CustomerLegend items={salesByCustomerData?.legendItems} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ventas por tipo de item</CardTitle>
          <CardDescription>Ventas anuales agrupadas por items de catalogo y no catalogo.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {salesByCatalogData ? (
              <Bar data={salesByCatalogData} options={buildStackedBarOptions()} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Sin datos de ventas para graficar.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ItemDetailDialog
        open={itemModal.open}
        onOpenChange={(open) => setItemModal((prev) => ({ ...prev, open }))}
        item={itemModal.item}
        movements={movements}
        ventas={ventas}
        inventoryPeriod={inventoryPeriod}
        inventoryRange={inventoryRange}
      />
    </div>
  );
}
