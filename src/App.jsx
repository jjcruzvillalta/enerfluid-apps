
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
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
} from "chart.js";
import "chartjs-adapter-date-fns";
import {
  buildCatalogIndex,
  buildCostSeriesForItems,
  buildItemsIndex,
  buildSalesPriceSeriesForItems,
  buildSeriesForItems,
  formatCurrency,
  getMovementSign,
  normalizeText,
  parseMovements,
  parseVentas,
  readSheetRows,
  loadFromFile,
  buildUploadRows,
} from "./lib/data";
import { hasNewerLogs, readCachePayload, writeCachePayload } from "./lib/cache";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { Sheet, SheetContent } from "./components/ui/sheet";
import { cn } from "./lib/utils";
import {
  BarChart3,
  Clock,
  FileUp,
  LogOut,
  Menu,
  RefreshCw,
  UploadCloud,
  Warehouse,
  X,
} from "lucide-react";

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

const SUPABASE_CONFIG = window.SUPABASE_CONFIG || {};
const SUPABASE_URL = SUPABASE_CONFIG.url || window.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey || window.SUPABASE_ANON_KEY || "";
const SUPABASE_ALLOWED_EMAIL = (SUPABASE_CONFIG.allowedEmail || window.SUPABASE_ALLOWED_EMAIL || "").toLowerCase();
const SUPABASE_UPLOAD_FUNCTION =
  SUPABASE_CONFIG.uploadFunction || window.SUPABASE_UPLOAD_FUNCTION || "upload-excel";
const SUPABASE_TABLES = SUPABASE_CONFIG.tables || window.SUPABASE_TABLES || {
  movements: "movimientos",
  ventas: "ventas",
  items: "listado_items",
  catalogo: "catalogo_items",
};

const supabaseClient = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const palette = [
  "#1f6feb",
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#94a3b8",
  "#38bdf8",
  "#f97316",
  "#a855f7",
];

const hashKey = (value) => {
  const text = String(value || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const colorForKey = (value) => palette[hashKey(value) % palette.length];

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

const formatDate = (date) => date.toISOString().slice(0, 10);

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-EC", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const parseDateInput = (value, endOfDay = false) => {
  if (!value) return null;
  const suffix = endOfDay ? "T23:59:59" : "T00:00:00";
  return new Date(`${value}${suffix}`);
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addMonths = (date, months) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const getTimeUnit = (period) => {
  if (period === "day") return "day";
  if (period === "week") return "week";
  if (period === "month") return "month";
  return "year";
};

const formatTick = (value, period) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value ?? "");
  if (period === "day") {
    return date.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit" });
  }
  if (period === "week") {
    const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = temp.getUTCDay() || 7;
    temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((temp - yearStart) / 86400000 + 1) / 7);
    return `W${String(week).padStart(2, "0")}`;
  }
  if (period === "month") {
    return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getFullYear()).slice(2)}`;
  }
  return String(date.getFullYear());
};

const buildPoints = (dates, values) =>
  dates.map((date, index) => ({
    x: date,
    y: values[index] ?? null,
  }));

const formatNumber = (value, digits = 0) =>
  Number.isFinite(value) ? value.toLocaleString("es-EC", { maximumFractionDigits: digits }) : "-";

const LoginScreen = ({ email, password, onEmailChange, onPasswordChange, onLogin, status }) => (
  <div className="min-h-screen bg-cloud flex items-center justify-center px-4">
    <div className="grid w-full max-w-4xl overflow-hidden rounded-[32px] glass-panel md:grid-cols-[1.1fr_0.9fr]">
      <div
        className="relative hidden overflow-hidden md:flex flex-col justify-between p-10 text-white"
        style={{
          backgroundImage: "url(/login-hero.png)",
          backgroundRepeat: "no-repeat",
          backgroundSize: "auto 100%",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-navy/70 via-slate-900/55 to-ink/45" />
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-[0.25em] text-white/70">Enerfluid</p>
          <p className="text-lg font-semibold">Inventario Inteligente</p>
        </div>
        <div className="relative z-10">
          <h2 className="text-2xl font-semibold leading-tight">Gestiona inventario y catálogo en un solo panel.</h2>
          <p className="mt-3 text-sm text-white/70">
            Accede con tu usuario autorizado y carga los archivos de manera segura.
          </p>
        </div>
      </div>
      <div className="p-8 md:p-10">
        <div className="flex items-center gap-3">
          <img src="/enerfluid-logo.png" alt="Enerfluid" className="h-9" />
        </div>
        <div className="mt-5 space-y-2">
          <h1 className="text-2xl font-semibold text-slate-800">Bienvenido</h1>
          <p className="text-sm text-slate-500">Inicia sesion para acceder al panel.</p>
        </div>
        <div className="mt-6 space-y-4">
          <label className="block text-sm text-slate-600">
            Email
            <Input value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="tu@correo.com" />
          </label>
          <label className="block text-sm text-slate-600">
            Contrasena
            <Input type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="********" />
          </label>
          <Button className="w-full" onClick={onLogin}>
            Ingresar
          </Button>
          <div className="flex items-center justify-center">
            <Badge variant="outline">{status}</Badge>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const NavButton = ({ active, onClick, icon: Icon, children }) => (
  <button
    className={cn(
      "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition",
      active
        ? "border-accent/20 bg-accentSoft text-accent shadow-sm"
        : "border-transparent bg-transparent text-slate-600 hover:bg-accentSoft/60"
    )}
    onClick={onClick}
    type="button"
  >
    {Icon ? <Icon className="h-4 w-4" /> : null}
    <span>{children}</span>
  </button>
);

const DataStatus = ({ label, value, muted }) => (
  <div className="text-xs text-slate-500">
    <span className={muted ? "text-slate-400" : "text-slate-500"}>{label}</span>
    <strong className="ml-2 text-ink">{value}</strong>
  </div>
);

const UploadCard = ({
  title,
  fileName,
  dbStatus,
  updatedAt,
  status,
  onSelect,
  onUpload,
  uploading,
}) => (
  <Card className="p-4">
    <div className="flex items-center justify-between">
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      <FileUp className="h-4 w-4 text-slate-400" />
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-mist px-3 py-1 text-xs text-slate-600 hover:bg-white">
        <input className="hidden" type="file" accept=".xlsx,.xls" onChange={onSelect} />
        Elegir archivo
      </label>
      <Button size="sm" onClick={onUpload} disabled={uploading}>
        {uploading ? "Subiendo" : "Subir"}
      </Button>
    </div>
    <div className="mt-3 space-y-1">
      <DataStatus label="Archivo:" value={fileName || "Sin archivo seleccionado"} muted={!fileName} />
      <DataStatus label="Supabase:" value={dbStatus || "-"} />
      <DataStatus label="Actualizado:" value={updatedAt || "-"} />
      <DataStatus label="Estado:" value={status || "Sin subir"} />
    </div>
  </Card>
);

const ChartWrap = ({ title, children, empty }) => (
  <Card className="p-4">
    <h4 className="text-sm font-semibold text-ink">{title}</h4>
    <div className="mt-3 h-60 relative">
      {children}
      {empty ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Sin datos para graficar.</div>
      ) : null}
    </div>
  </Card>
);

const CustomerLegend = ({ items }) => {
  if (!items?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
};

const getSelectedSet = (itemsIndex, selection) => {
  if (!itemsIndex) return null;
  if (!selection || selection.size === itemsIndex.items.length) return null;
  return selection;
};

const getMovementsRange = (rows) => {
  if (!rows?.length) return null;
  let minDate = rows[0].date;
  let maxDate = rows[0].date;
  rows.forEach((row) => {
    if (row.date < minDate) minDate = row.date;
    if (row.date > maxDate) maxDate = row.date;
  });
  return { minDate, maxDate };
};

const buildLineDistribution = (itemsIndex, selectedSet) => {
  if (!itemsIndex) return null;
  const totals = new Map();
  itemsIndex.items.forEach((item) => {
    if (selectedSet && !selectedSet.has(item.code)) return;
    const value = Number.isFinite(item.stock) && Number.isFinite(item.cost) ? item.stock * item.cost : 0;
    const key = item.line || "Sin linea";
    totals.set(key, (totals.get(key) || 0) + value);
  });
  const entries = [...totals.entries()].filter((entry) => Number.isFinite(entry[1]) && entry[1] > 0);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, 8);
  const others = entries.slice(8).reduce((sum, entry) => sum + entry[1], 0);
  if (others > 0) top.push(["Otros", others]);
  return top;
};

const buildCatalogShare = (itemsIndex, selectedSet) => {
  if (!itemsIndex) return null;
  let catalogValue = 0;
  let nonCatalogValue = 0;
  itemsIndex.items.forEach((item) => {
    if (selectedSet && !selectedSet.has(item.code)) return;
    const value = Number.isFinite(item.stock) && Number.isFinite(item.cost) ? item.stock * item.cost : 0;
    if (item.isCatalog) catalogValue += value;
    else nonCatalogValue += value;
  });
  if (!catalogValue && !nonCatalogValue) return null;
  return {
    labels: ["Catalogo", "No catalogo"],
    values: [catalogValue, nonCatalogValue],
  };
};

const buildTopCustomersByYearData = (rows, maxTop = 10, legendTop = 10) => {
  if (!rows?.length) return null;
  const byYear = new Map();
  const totalsByCustomer = new Map();
  rows.forEach((row) => {
    const year = row.date instanceof Date ? row.date.getFullYear() : NaN;
    if (!Number.isFinite(year)) return;
    const value = Number.isFinite(row.ventaBruta) ? row.ventaBruta : 0;
    if (!value) return;
    const customer = row.persona || "Sin cliente";
    const yearMap = byYear.get(year) || new Map();
    yearMap.set(customer, (yearMap.get(customer) || 0) + value);
    byYear.set(year, yearMap);
  });

  if (!byYear.size) return null;

  const years = Array.from(byYear.keys()).sort((a, b) => a - b);
  const topEntriesByYear = new Map();
  let hasOthers = false;
  years.forEach((year) => {
    const entries = Array.from(byYear.get(year).entries()).sort((a, b) => b[1] - a[1]);
    const topEntries = entries.slice(0, maxTop);
    const othersTotal = entries.slice(maxTop).reduce((sum, entry) => sum + entry[1], 0);
    topEntriesByYear.set(year, topEntries);
    topEntries.forEach(([customer, value]) => {
      totalsByCustomer.set(customer, (totalsByCustomer.get(customer) || 0) + value);
    });
    if (othersTotal > 0) hasOthers = true;
  });

  const legendItems = Array.from(totalsByCustomer.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, legendTop)
    .map(([customer]) => ({ label: customer, color: colorForKey(customer) }));

  if (hasOthers) legendItems.push({ label: "Otros", color: palette[5] });

  const datasets = [];
  if (hasOthers) {
    const othersData = years.map((year) => {
      const entries = Array.from(byYear.get(year).entries()).sort((a, b) => b[1] - a[1]);
      return entries.slice(maxTop).reduce((sum, entry) => sum + entry[1], 0);
    });
    datasets.push({
      label: "Otros",
      data: othersData,
      backgroundColor: palette[5],
      stack: "ventas",
    });
  }

  for (let rank = maxTop - 1; rank >= 0; rank -= 1) {
    const customerByYear = {};
    const data = [];
    const colors = [];
    years.forEach((year) => {
      const entry = topEntriesByYear.get(year)?.[rank];
      if (!entry) {
        data.push(0);
        colors.push("rgba(0, 0, 0, 0)");
        return;
      }
      const [customer, value] = entry;
      customerByYear[String(year)] = customer;
      data.push(value);
      colors.push(colorForKey(customer));
    });
    datasets.push({
      label: `Top ${rank + 1}`,
      data,
      customerByYear,
      backgroundColor: colors,
      stack: "ventas",
    });
  }

  return {
    labels: years.map(String),
    datasets,
    legendItems,
  };
};

const getSelectedMotives = (motives, selected) => {
  if (!motives?.length) return null;
  if (!selected || selected.size === motives.length) return null;
  return selected;
};

const buildReplenishmentData = ({
  itemsIndex,
  movements,
  selectedSet,
  monthsWindow,
  targetMonths,
  leadTimeMonths,
  bufferMonths,
  selectedMotives,
}) => {
  if (!itemsIndex || !movements?.length) return null;
  const items = itemsIndex.items.filter((item) => item.isCatalog && (!selectedSet || selectedSet.has(item.code)));
  if (!items.length) return { rows: [], brandRows: [] };

  const range = getMovementsRange(movements);
  if (!range) return { rows: [], brandRows: [] };

  const endDate = range.maxDate;
  const startDate = addMonths(endDate, -monthsWindow);

  const dateKeys = [];
  for (let day = new Date(startDate); day <= endDate; day = addDays(day, 1)) {
    dateKeys.push(formatDate(day));
  }

  const itemSet = new Set(items.map((item) => item.code));
  const deltaByItem = new Map();
  const beforeStock = new Map();
  const consumptionByItem = new Map();

  movements.forEach((row) => {
    if (!itemSet.has(row.item)) return;
    const qty = Number.isFinite(row.qty) ? Math.abs(row.qty) : 0;
    if (!qty) return;
    const sign = getMovementSign(row);
    const delta = qty * sign;

    if (row.date < startDate) {
      beforeStock.set(row.item, (beforeStock.get(row.item) || 0) + delta);
      return;
    }
    if (row.date > endDate) return;
    const key = formatDate(row.date);
    const map = deltaByItem.get(row.item) || new Map();
    map.set(key, (map.get(key) || 0) + delta);
    deltaByItem.set(row.item, map);

    if (sign < 0 && (!selectedMotives || selectedMotives.has(row.mot || ""))) {
      consumptionByItem.set(row.item, (consumptionByItem.get(row.item) || 0) + qty);
    }
  });

  const leadMonths = Math.max(0, Number(leadTimeMonths) || 0);
  const buffer = Math.max(0, Number(bufferMonths) || 0);
  const minCoverageMonths = leadMonths + buffer;
  const coverageTarget = Math.max(minCoverageMonths, Number(targetMonths) || 0);

  const rows = items.map((item) => {
    const stockCurrent = Number.isFinite(item.stock) ? item.stock : 0;
    let stock = beforeStock.get(item.code) || 0;
    const deltas = deltaByItem.get(item.code);
    let availableDays = 0;
    dateKeys.forEach((key) => {
      if (deltas && deltas.has(key)) stock += deltas.get(key);
      if (stock > 0) availableDays += 1;
    });

    const consumptionUnits = consumptionByItem.get(item.code) || 0;
    const availableMonths = availableDays / 30;
    const consumptionMonthly = availableMonths > 0 ? consumptionUnits / availableMonths : 0;
    const requiredStock = consumptionMonthly * coverageTarget;
    const monthsCoverage =
      consumptionMonthly > 0 ? stockCurrent / consumptionMonthly : stockCurrent > 0 ? Infinity : 0;
    const shouldBuy = consumptionMonthly > 0 && monthsCoverage <= minCoverageMonths;
    const qtyToBuy = shouldBuy ? Math.max(0, requiredStock - stockCurrent) : 0;
    const unitCost = Number.isFinite(item.lastCost) ? item.lastCost : item.cost;
    const costEstimate = Number.isFinite(unitCost) ? qtyToBuy * unitCost : NaN;

    return {
      code: item.code,
      desc: item.desc,
      brand: item.brand,
      stockCurrent,
      consumptionUnits,
      availableMonths,
      consumptionMonthly,
      monthsCoverage,
      minCoverageMonths,
      coverageTarget,
      shouldBuy,
      qtyToBuy,
      costEstimate,
    };
  });

  rows.sort((a, b) => {
    if (a.shouldBuy !== b.shouldBuy) return a.shouldBuy ? -1 : 1;
    return (b.costEstimate || 0) - (a.costEstimate || 0);
  });

  const brandMap = new Map();
  rows.forEach((row) => {
    if (!row.qtyToBuy) return;
    const entry = brandMap.get(row.brand) || { brand: row.brand, items: 0, qty: 0, cost: 0 };
    entry.items += 1;
    entry.qty += row.qtyToBuy;
    entry.cost += row.costEstimate || 0;
    brandMap.set(row.brand, entry);
  });

  const brandRows = [...brandMap.values()].sort((a, b) => b.cost - a.cost);
  return {
    rows,
    brandRows,
    startDate,
    endDate,
    monthsWindow,
    minCoverageMonths,
    coverageTarget,
    leadTimeMonths: leadMonths,
    bufferMonths: buffer,
  };
};

const buildLineOptions = (period, labelFormatter) => ({
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
        label: labelFormatter,
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

const buildStackedBarOptions = (legendTotals) => ({
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

const customerStackedOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label(context) {
          const year = context.label;
          const customer = context.dataset.customerByYear?.[year];
          const label = customer || context.dataset.label;
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

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authStatus, setAuthStatus] = useState("No autenticado");
  const [session, setSession] = useState(null);
  const [activeView, setActiveView] = useState("upload");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadStatus, setLoadStatus] = useState("Sin cargar");
  const loadInProgressRef = useRef(false);
  const hasAuthSessionRef = useRef(false);

  const [uploadLogs, setUploadLogs] = useState([]);
  const [movRows, setMovRows] = useState([]);
  const [ventasRows, setVentasRows] = useState([]);
  const [itemsRows, setItemsRows] = useState([]);
  const [catalogRows, setCatalogRows] = useState([]);
  const [movements, setMovements] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [itemsIndex, setItemsIndex] = useState(null);
  const [catalogIndex, setCatalogIndex] = useState(null);

  const [selection, setSelection] = useState(new Set());
  const [itemFilter, setItemFilter] = useState("");

  const [inventoryPeriod, setInventoryPeriod] = useState("month");
  const [inventoryStartDate, setInventoryStartDate] = useState("");
  const [inventoryEndDate, setInventoryEndDate] = useState("");

  const [movementStartDate, setMovementStartDate] = useState("");
  const [movementEndDate, setMovementEndDate] = useState("");
  const [showIngresos, setShowIngresos] = useState(true);
  const [showEgresos, setShowEgresos] = useState(true);
  const [movementLimit, setMovementLimit] = useState(100);
  const [itemsTableLimit, setItemsTableLimit] = useState(200);
  const [replenishmentLimit, setReplenishmentLimit] = useState(200);

  const [motSelection, setMotSelection] = useState(new Set());
  const [consumptionMotSelection, setConsumptionMotSelection] = useState(new Set());
  const [consumptionWindowMonths, setConsumptionWindowMonths] = useState(12);
  const [leadTimeMonths, setLeadTimeMonths] = useState(1.5);
  const [bufferMonths, setBufferMonths] = useState(3);
  const [targetCoverageMonths, setTargetCoverageMonths] = useState(12);

  const [brandModal, setBrandModal] = useState({ open: false, brand: "", rows: [] });
  const [itemModal, setItemModal] = useState({ open: false, item: null });

  const [uploadFiles, setUploadFiles] = useState({
    movimientos: null,
    ventas: null,
    items: null,
    catalogo: null,
  });
  const [uploadStatus, setUploadStatus] = useState({
    movimientos: "Sin subir",
    ventas: "Sin subir",
    items: "Sin subir",
    catalogo: "Sin subir",
  });
  const [uploadLoading, setUploadLoading] = useState({
    movimientos: false,
    ventas: false,
    items: false,
    catalogo: false,
  });

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

  const lineDistribution = useMemo(() => buildLineDistribution(itemsIndex, selectedSet), [itemsIndex, selectedSet]);

  const catalogShare = useMemo(() => buildCatalogShare(itemsIndex, selectedSet), [itemsIndex, selectedSet]);

  const salesByCustomerData = useMemo(() => {
    if (!ventas?.length) return null;
    const rows = selectedSet ? ventas.filter((row) => selectedSet.has(row.item)) : ventas.slice();
    return buildTopCustomersByYearData(rows, 10, 10);
  }, [ventas, selectedSet]);

  const catalogLookup = useMemo(() => {
    const map = new Map();
    if (itemsIndex?.items?.length) {
      itemsIndex.items.forEach((item) => {
        map.set(item.code, item.isCatalog);
      });
    }
    if (catalogIndex?.size) {
      catalogIndex.forEach((_value, code) => {
        map.set(code, true);
      });
    }
    return map;
  }, [itemsIndex, catalogIndex]);

  const salesByCatalogData = useMemo(() => {
    if (!ventas?.length) return null;
    const rows = selectedSet ? ventas.filter((row) => selectedSet.has(row.item)) : ventas.slice();
    const byYear = new Map();

    rows.forEach((row) => {
      const year = row.date instanceof Date ? row.date.getFullYear() : NaN;
      if (!Number.isFinite(year)) return;
      const value = Number.isFinite(row.ventaBruta) ? row.ventaBruta : 0;
      if (!value) return;
      const isCatalog = catalogLookup.get(row.item) === true;
      const yearMap = byYear.get(year) || { catalogo: 0, noCatalogo: 0 };
      if (isCatalog) yearMap.catalogo += value;
      else yearMap.noCatalogo += value;
      byYear.set(year, yearMap);
    });

    if (!byYear.size) return null;
    const years = Array.from(byYear.keys()).sort((a, b) => a - b);
    return {
      labels: years.map(String),
      datasets: [
        {
          label: "Catalogo",
          data: years.map((year) => byYear.get(year)?.catalogo || 0),
          backgroundColor: palette[0],
          stack: "ventas",
        },
        {
          label: "No catalogo",
          data: years.map((year) => byYear.get(year)?.noCatalogo || 0),
          backgroundColor: palette[4],
          stack: "ventas",
        },
      ],
    };
  }, [ventas, selectedSet, catalogLookup]);

  const itemSalesByCustomerData = useMemo(() => {
    if (!itemModal.item || !ventas?.length) return null;
    const rows = ventas.filter((row) => row.item === itemModal.item.code);
    return buildTopCustomersByYearData(rows, 10, 10);
  }, [ventas, itemModal.item]);

  const motives = useMemo(() => {
    const set = new Set();
    movements.forEach((row) => {
      if (row.mot !== undefined) set.add(row.mot || "");
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
    const selectedMotives = getSelectedMotives(motives, motSelection);
    rows = rows.filter((row) => {
      const sign = getMovementSign(row);
      if (sign > 0 && !showIngresos) return false;
      if (sign < 0 && !showEgresos) return false;
      if (selectedMotives && !selectedMotives.has(row.mot || "")) return false;
      return true;
    });
    return rows.sort((a, b) => b.date - a.date);
  }, [movements, selectedSet, movementRange, motSelection, motives, showIngresos, showEgresos]);

  const visibleMovements = useMemo(() => movementRows.slice(0, movementLimit), [movementRows, movementLimit]);

  const replenishmentData = useMemo(() =>
    buildReplenishmentData({
      itemsIndex,
      movements,
      selectedSet: null,
      monthsWindow: Math.max(1, Number(consumptionWindowMonths) || 12),
      targetMonths: Math.max(0, Number(targetCoverageMonths) || 0),
      leadTimeMonths: Math.max(0, Number(leadTimeMonths) || 0),
      bufferMonths: Math.max(0, Number(bufferMonths) || 0),
      selectedMotives: getSelectedMotives(motives, consumptionMotSelection),
    }), [
      itemsIndex,
      movements,
      consumptionMotSelection,
      consumptionWindowMonths,
      leadTimeMonths,
      bufferMonths,
      targetCoverageMonths,
      motives,
    ]
  );

  const visibleReplenishmentRows = useMemo(
    () => replenishmentData?.rows?.slice(0, replenishmentLimit) || [],
    [replenishmentData, replenishmentLimit]
  );

  const catalogMissing = useMemo(() => {
    if (!catalogIndex || !itemsIndex) return [];
    const itemsSet = new Set(itemsIndex.items.map((item) => item.code));
    return Array.from(catalogIndex.keys()).filter((code) => !itemsSet.has(code));
  }, [catalogIndex, itemsIndex]);

  const uploadLogsByType = useMemo(() => {
    const map = new Map();
    uploadLogs.forEach((row) => {
      if (!map.has(row.type)) map.set(row.type, row);
    });
    return map;
  }, [uploadLogs]);

  const uploadDbStatus = useMemo(
    () => ({
      movimientos: `${movRows.length} filas`,
      ventas: `${ventasRows.length} filas`,
      items: `${itemsRows.length} filas`,
      catalogo: `${catalogRows.length} filas`,
    }),
    [movRows, ventasRows, itemsRows, catalogRows]
  );

  const buildPieData = (labels, values) => ({
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: labels.map((_, idx) => palette[idx % palette.length]),
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.95)",
        hoverOffset: 10,
        borderRadius: 4,
      },
    ],
  });

  const handleSession = useCallback(
    async (nextSession) => {
      const wasAuthenticated = hasAuthSessionRef.current;
      setSession((prev) => {
        if (!nextSession) return null;
        if (prev?.access_token && nextSession?.access_token && prev.access_token === nextSession.access_token) {
          return prev;
        }
        return nextSession;
      });
      if (!nextSession || !nextSession.user) {
        hasAuthSessionRef.current = false;
        setAuthStatus("No autenticado");
        return;
      }
      const userEmail = String(nextSession.user.email || "").toLowerCase();
      if (SUPABASE_ALLOWED_EMAIL && userEmail !== SUPABASE_ALLOWED_EMAIL) {
        setAuthStatus("Usuario no autorizado");
        if (supabaseClient) await supabaseClient.auth.signOut();
        hasAuthSessionRef.current = false;
        return;
      }
      setAuthStatus("Autenticado");
      hasAuthSessionRef.current = true;
      if (!wasAuthenticated) setActiveView("upload");
    },
    []
  );

  const fetchAllRows = useCallback(async (table) => {
    const pageSize = 1000;
    let from = 0;
    let allRows = [];
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabaseClient.from(table).select("*").range(from, from + pageSize - 1);
      if (error) throw error;
      allRows = allRows.concat(data || []);
      if (!data || data.length < pageSize) {
        hasMore = false;
      } else {
        from += pageSize;
      }
    }
    return allRows;
  }, []);

  const applyData = useCallback((payload) => {
    const nextMovRows = payload?.movRows || [];
    const nextVentasRows = payload?.ventasRows || [];
    const nextItemsRows = payload?.itemsRows || [];
    const nextCatalogRows = payload?.catalogRows || [];
    const nextUploadLogs = payload?.uploadLogs || [];

    setMovRows(nextMovRows);
    setVentasRows(nextVentasRows);
    setItemsRows(nextItemsRows);
    setCatalogRows(nextCatalogRows);
    setUploadLogs(nextUploadLogs);

    const parsedMovements = parseMovements(nextMovRows);
    const parsedVentas = parseVentas(nextVentasRows);
    setMovements(parsedMovements);
    setVentas(parsedVentas);

    const catalogIdx = buildCatalogIndex(nextCatalogRows);
    setCatalogIndex(catalogIdx);
    const itemsIdx = buildItemsIndex(nextItemsRows, catalogIdx);
    setItemsIndex(itemsIdx);

    setSelection((prev) => {
      if (!itemsIdx?.items?.length) return new Set();
      if (!prev || !prev.size) return new Set(itemsIdx.items.map((item) => item.code));
      const next = new Set();
      itemsIdx.items.forEach((item) => {
        if (prev.has(item.code)) next.add(item.code);
      });
      return next.size ? next : new Set(itemsIdx.items.map((item) => item.code));
    });

    if (parsedMovements.length) {
      const range = getMovementsRange(parsedMovements);
      if (range) {
        setInventoryStartDate((prev) => prev || formatDate(range.minDate));
        setInventoryEndDate((prev) => prev || formatDate(range.maxDate));
        setMovementStartDate((prev) => prev || formatDate(range.minDate));
        setMovementEndDate((prev) => prev || formatDate(range.maxDate));
      }
    }
    setLoadStatus("Conectado");
  }, []);

  const loadAllFromSupabase = useCallback(
    async ({ force = false, sessionOverride = null } = {}) => {
      if (!supabaseClient) {
        setLoadStatus("Configura supabase-config.js");
        return;
      }
      const activeSession = sessionOverride || session;
      if (!activeSession) {
        setLoadStatus("Inicia sesion");
        return;
      }
      if (loadInProgressRef.current) return;
      loadInProgressRef.current = true;
      try {
        setLoading(true);
        setLoadStatus("Cargando...");
        let cachedPayload = null;
        if (!force) {
          cachedPayload = await readCachePayload();
          const cachedHasPersona = cachedPayload?.ventasRows?.some((row) => row?.persona || row?.cliente);
          if (cachedPayload && !cachedHasPersona) cachedPayload = null;
          if (cachedPayload) applyData(cachedPayload);
        }

        const { data: logsData, error: logsError } = await supabaseClient
          .from("upload_logs")
          .select("*")
          .order("uploaded_at", { ascending: false })
          .limit(1000);
        const isMissingLogsTable =
          logsError && (logsError.status === 404 || logsError.code === "42P01");
        if (logsError && !isMissingLogsTable) throw logsError;
        const logs = logsData || [];
        setUploadLogs(logs);

        const shouldReload = force || !cachedPayload || hasNewerLogs(cachedPayload.uploadLogs, logs);
        if (!shouldReload) {
          setLoading(false);
          setLoadStatus("Conectado");
          return;
        }

        const [nextMovRows, nextVentasRows, nextItemsRows, nextCatalogRows] = await Promise.all([
          fetchAllRows(SUPABASE_TABLES.movements),
          fetchAllRows(SUPABASE_TABLES.ventas),
          fetchAllRows(SUPABASE_TABLES.items),
          fetchAllRows(SUPABASE_TABLES.catalogo),
        ]);

        const payload = {
          movRows: nextMovRows,
          ventasRows: nextVentasRows,
          itemsRows: nextItemsRows,
          catalogRows: nextCatalogRows,
          uploadLogs: logs,
        };
        applyData(payload);
        await writeCachePayload(payload);
        setLoading(false);
        setLoadStatus("Conectado");
      } catch (error) {
        console.error(error);
        setLoading(false);
        setLoadStatus("Error al cargar");
      } finally {
        loadInProgressRef.current = false;
      }
    },
    [session, applyData, fetchAllRows]
  );

  const handleUpload = useCallback(
    async (type) => {
      if (!supabaseClient) {
        setUploadStatus((prev) => ({ ...prev, [type]: "Configura Supabase" }));
        return;
      }
      if (!session) {
        setUploadStatus((prev) => ({ ...prev, [type]: "Inicia sesion" }));
        return;
      }
      const file = uploadFiles[type];
      if (!file) {
        setUploadStatus((prev) => ({ ...prev, [type]: "Selecciona un archivo" }));
        return;
      }
      const confirmReplace = window.confirm(
        "Esta carga reemplazara completamente la tabla en Supabase. Deseas continuar?"
      );
      if (!confirmReplace) {
        setUploadStatus((prev) => ({ ...prev, [type]: "Cancelado" }));
        return;
      }
      setUploadLoading((prev) => ({ ...prev, [type]: true }));
      setUploadStatus((prev) => ({ ...prev, [type]: "Leyendo archivo..." }));

      try {
        const workbook = await loadFromFile(file);
        const rawRows = readSheetRows(workbook);
        const payloadRows = buildUploadRows(type, rawRows);
        if (!payloadRows.length) {
          setUploadStatus((prev) => ({ ...prev, [type]: "Sin datos para subir" }));
          setUploadLoading((prev) => ({ ...prev, [type]: false }));
          return;
        }

        const { data: sessionData } = await supabaseClient.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) {
          setUploadStatus((prev) => ({ ...prev, [type]: "Sesion expirada" }));
          setUploadLoading((prev) => ({ ...prev, [type]: false }));
          return;
        }

        const chunkSize = 500;
        const totalBatches = Math.ceil(payloadRows.length / chunkSize);
        for (let i = 0; i < payloadRows.length; i += chunkSize) {
          const batchIndex = Math.floor(i / chunkSize) + 1;
          setUploadStatus((prev) => ({ ...prev, [type]: `Subiendo ${batchIndex}/${totalBatches}...` }));
          const batch = payloadRows.slice(i, i + chunkSize);
          const { data, error } = await supabaseClient.functions.invoke(SUPABASE_UPLOAD_FUNCTION, {
            body: {
              type,
              rows: batch,
              replace: i === 0,
              fileName: file?.name || "",
            },
            headers: {
              Authorization: `Bearer ${accessToken}`,
              apikey: SUPABASE_ANON_KEY,
            },
          });
          if (error) {
            console.error(error);
            setUploadStatus((prev) => ({ ...prev, [type]: "Error al subir" }));
            setUploadLoading((prev) => ({ ...prev, [type]: false }));
            return;
          }
          if (batchIndex === totalBatches) {
            setUploadStatus((prev) => ({ ...prev, [type]: `Cargado (${data?.inserted ?? payloadRows.length})` }));
          }
        }
        setUploadLoading((prev) => ({ ...prev, [type]: false }));
        await loadAllFromSupabase({ force: true, sessionOverride: session });
      } catch (error) {
        console.error(error);
        setUploadStatus((prev) => ({ ...prev, [type]: "Error al leer" }));
        setUploadLoading((prev) => ({ ...prev, [type]: false }));
      }
    },
    [session, uploadFiles, loadAllFromSupabase]
  );

  useEffect(() => {
    if (!motives.length) return;
    setMotSelection(new Set(motives));
    setConsumptionMotSelection(new Set(motives));
  }, [motives]);

  useEffect(() => {
    setItemsTableLimit(200);
  }, [itemsTableRows.length]);

  useEffect(() => {
    const total = replenishmentData?.rows?.length || 0;
    if (!total) {
      setReplenishmentLimit(200);
      return;
    }
    setReplenishmentLimit((prev) => Math.min(prev, total) || 200);
  }, [replenishmentData]);

  useEffect(() => {
    if (!supabaseClient) {
      setAuthStatus("Configura supabase-config.js");
      return;
    }
    const { data: authListener } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      handleSession(nextSession);
      if (nextSession?.user) loadAllFromSupabase({ sessionOverride: nextSession });
    });
    supabaseClient.auth.getSession().then(({ data }) => {
      handleSession(data.session);
      if (data.session?.user) loadAllFromSupabase({ sessionOverride: data.session });
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [handleSession, loadAllFromSupabase]);

  const handleLogin = async () => {
    if (!supabaseClient) {
      setAuthStatus("Configura supabase-config.js");
      return;
    }
    if (!email || !password) {
      setAuthStatus("Completa email y contrasena");
      return;
    }
    setAuthStatus("Verificando...");
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      console.error(error);
      setAuthStatus("No se pudo iniciar sesion");
    }
  };

  const handleLogout = async () => {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
  };

  const userGreeting = session?.user?.email || "Usuario";

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
            pointHoverRadius: 3,
          },
        ],
      }
    : null;

  const valueChartData = inventorySeries
    ? {
        datasets: [
          {
            label: "Valor inventario (USD)",
            data: buildPoints(inventorySeries.dates, inventorySeries.valueSeries),
            borderColor: "#60a5fa",
            backgroundColor: "rgba(96, 165, 250, 0.18)",
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 3,
          },
        ],
      }
    : null;

  const latestRangeLabel = inventorySeries
    ? `Rango: ${inventorySeries.startDate ? formatDate(inventorySeries.startDate) : "-"} a ${
        inventorySeries.endDate ? formatDate(inventorySeries.endDate) : "-"
      }`
    : "Sin datos";

  const lineChartOptions = inventorySeries
    ? buildLineOptions(inventorySeries.period, (context) =>
        `Unidades: ${Number(context.parsed.y).toLocaleString("es-EC")}`
      )
    : buildLineOptions(inventoryPeriod, () => "");

  const valueChartOptions = inventorySeries
    ? buildLineOptions(inventorySeries.period, (context) => `USD: ${formatCurrency(context.parsed.y)}`)
    : buildLineOptions(inventoryPeriod, () => "");

  const linePieData = lineDistribution
    ? buildPieData(
        lineDistribution.map((row) => row[0]),
        lineDistribution.map((row) => row[1])
      )
    : null;
  const catalogPieData = catalogShare ? buildPieData(catalogShare.labels, catalogShare.values) : null;

  const itemModalSeries = useMemo(() => {
    if (!itemModal.item) return null;
    return buildSeriesForItems({
      movements,
      period: inventoryPeriod,
      ...inventoryRange,
      itemsSet: new Set([itemModal.item.code]),
    });
  }, [itemModal.item, movements, inventoryPeriod, inventoryRange]);

  const itemSalesSeries = useMemo(() => {
    if (!itemModal.item) return null;
    return buildSalesPriceSeriesForItems({
      ventasRows: ventas,
      period: inventoryPeriod,
      ...inventoryRange,
      itemsSet: new Set([itemModal.item.code]),
    });
  }, [itemModal.item, ventas, inventoryPeriod, inventoryRange]);

  const itemCostSeries = useMemo(() => {
    if (!itemModal.item) return null;
    return buildCostSeriesForItems({
      movements,
      period: inventoryPeriod,
      ...inventoryRange,
      itemsSet: new Set([itemModal.item.code]),
    });
  }, [itemModal.item, movements, inventoryPeriod, inventoryRange]);

  const itemMovements = useMemo(() => {
    if (!itemModal.item) return [];
    return movements.filter((row) => row.item === itemModal.item.code).sort((a, b) => b.date - a.date);
  }, [itemModal.item, movements]);

  const itemSalesChartData = itemSalesSeries
    ? {
        datasets: [
          {
            label: "Precio unitario",
            data: buildPoints(itemSalesSeries.periodDates, itemSalesSeries.priceSeries),
            borderColor: "#1f6feb",
            backgroundColor: "rgba(31, 111, 235, 0.12)",
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 3,
            spanGaps: true,
          },
          {
            label: "Costo unitario",
            data: buildPoints(itemSalesSeries.periodDates, itemSalesSeries.costSeries),
            borderColor: "#34d399",
            backgroundColor: "rgba(52, 211, 153, 0.12)",
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 3,
            spanGaps: true,
          },
          {
            label: "Precio con descuento",
            data: buildPoints(itemSalesSeries.periodDates, itemSalesSeries.netSeries),
            borderColor: "#fbbf24",
            backgroundColor: "rgba(251, 191, 36, 0.12)",
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 3,
            spanGaps: true,
          },
        ],
      }
    : null;

  const itemSalesOptions = itemSalesSeries
    ? buildLineOptions(itemSalesSeries.period, (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`)
    : buildLineOptions(inventoryPeriod, () => "");

  const itemCostChartData = itemCostSeries
    ? {
        datasets: itemCostSeries.seriesList.map((series, idx) => ({
          label: series.supplier,
          data: buildPoints(itemCostSeries.periodDates, series.values),
          borderColor: palette[idx % palette.length],
          backgroundColor: "rgba(31, 111, 235, 0.08)",
          tension: 0.25,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 3,
          spanGaps: true,
        })),
      }
    : null;

  const itemCostOptions = itemCostSeries
    ? buildLineOptions(itemCostSeries.period, (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`)
    : buildLineOptions(inventoryPeriod, () => "");

  const itemUnitsChartData = itemModalSeries
    ? {
        datasets: [
          {
            label: "Unidades",
            data: buildPoints(itemModalSeries.dates, itemModalSeries.unitsSeries),
            borderColor: "#1f6feb",
            backgroundColor: "rgba(31, 111, 235, 0.18)",
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 3,
          },
        ],
      }
    : null;

  const itemValueChartData = itemModalSeries
    ? {
        datasets: [
          {
            label: "Valor inventario (USD)",
            data: buildPoints(itemModalSeries.dates, itemModalSeries.valueSeries),
            borderColor: "#60a5fa",
            backgroundColor: "rgba(96, 165, 250, 0.18)",
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 3,
          },
        ],
      }
    : null;

  const itemModalSubtitle = itemModalSeries
    ? `Rango: ${itemModalSeries.startDate ? formatDate(itemModalSeries.startDate) : "-"} a ${
        itemModalSeries.endDate ? formatDate(itemModalSeries.endDate) : "-"
      } | Agregacion: ${inventoryPeriod}`
    : "Sin datos";

  if (!session?.user) {
    return (
      <LoginScreen
        email={email}
        password={password}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onLogin={handleLogin}
        status={authStatus}
      />
    );
  }

  return (
    <div className="min-h-screen bg-cloud text-ink">
      <div className="flex min-h-screen">
        <aside className="hidden lg:flex w-72 flex-col border-r border-line bg-white px-6 py-8 shadow-soft lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
          <div className="flex items-center gap-3">
            <img src="/enerfluid-logo.png" alt="Enerfluid" className="h-10" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Enerfluid</p>
              <p className="text-sm font-semibold text-slate-700">Inventario</p>
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-3">
            <NavButton icon={UploadCloud} active={activeView === "upload"} onClick={() => setActiveView("upload")}>
              Carga de archivos
            </NavButton>
            <NavButton icon={BarChart3} active={activeView === "analysis"} onClick={() => setActiveView("analysis")}>
              Analisis agregado e individual
            </NavButton>
            <NavButton icon={Warehouse} active={activeView === "replenishment"} onClick={() => setActiveView("replenishment")}>
              Reposicion de stock
            </NavButton>
          </div>
          <div className="mt-auto rounded-2xl border border-line bg-mist p-4 text-xs text-slate-500">
            <p className="font-semibold text-slate-700">Sesion activa</p>
            <p className="mt-1 truncate">{userGreeting}</p>
          </div>
        </aside>

        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent className="lg:hidden">
            <div className="flex items-center justify-between">
              <img src="/enerfluid-logo.png" alt="Enerfluid" className="h-8" />
              <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <NavButton icon={UploadCloud} active={activeView === "upload"} onClick={() => { setActiveView("upload"); setDrawerOpen(false); }}>
                Carga de archivos
              </NavButton>
              <NavButton icon={BarChart3} active={activeView === "analysis"} onClick={() => { setActiveView("analysis"); setDrawerOpen(false); }}>
                Analisis agregado e individual
              </NavButton>
              <NavButton icon={Warehouse} active={activeView === "replenishment"} onClick={() => { setActiveView("replenishment"); setDrawerOpen(false); }}>
                Reposicion de stock
              </NavButton>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex-1 bg-gradient-to-br from-white via-cloud to-mist">
          <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-6 py-6 lg:px-10">
            <Card className="glass-panel">
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={() => setDrawerOpen(true)}
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                  <div>
                    <p className="text-sm text-slate-500">Hola, {userGreeting}</p>
                    <h2 className="text-xl font-semibold text-ink">Panel de Analisis de Inventario</h2>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                      loading ? "border-accent/30 text-accent" : "border-line text-slate-500"
                    )}
                  >
                    {loading ? <Clock className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    {loading ? "Cargando" : loadStatus}
                  </div>
                  <Button variant="outline" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Salir
                  </Button>
                </div>
              </CardHeader>
            </Card>

          {activeView === "upload" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Carga de Excel</CardTitle>
                  <CardDescription>Cada carga reemplaza completamente los datos anteriores en Supabase.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-line bg-mist p-4 text-sm text-slate-600">
                    <p className="font-semibold">Como funciona la carga</p>
                    <p>El navegador lee el Excel, lo convierte a filas y las envia en lotes al servidor.</p>
                    <p>En el primer lote se borra la tabla y luego se insertan los datos.</p>
                    <p>Si cierras la pagina o falla un lote, vuelve a subir el archivo.</p>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <UploadCard
                      title="Movimientos de inventario"
                      fileName={uploadFiles.movimientos?.name || ""}
                      dbStatus={uploadDbStatus.movimientos}
                      updatedAt={formatDateTime(uploadLogsByType.get("movimientos")?.uploaded_at)}
                      status={uploadStatus.movimientos}
                      uploading={uploadLoading.movimientos}
                      onSelect={(event) =>
                        setUploadFiles((prev) => ({ ...prev, movimientos: event.target.files?.[0] || null }))
                      }
                      onUpload={() => handleUpload("movimientos")}
                    />
                    <UploadCard
                      title="Ventas"
                      fileName={uploadFiles.ventas?.name || ""}
                      dbStatus={uploadDbStatus.ventas}
                      updatedAt={formatDateTime(uploadLogsByType.get("ventas")?.uploaded_at)}
                      status={uploadStatus.ventas}
                      uploading={uploadLoading.ventas}
                      onSelect={(event) =>
                        setUploadFiles((prev) => ({ ...prev, ventas: event.target.files?.[0] || null }))
                      }
                      onUpload={() => handleUpload("ventas")}
                    />
                    <UploadCard
                      title="Listado de items (costos y stock)"
                      fileName={uploadFiles.items?.name || ""}
                      dbStatus={uploadDbStatus.items}
                      updatedAt={formatDateTime(uploadLogsByType.get("items")?.uploaded_at)}
                      status={uploadStatus.items}
                      uploading={uploadLoading.items}
                      onSelect={(event) =>
                        setUploadFiles((prev) => ({ ...prev, items: event.target.files?.[0] || null }))
                      }
                      onUpload={() => handleUpload("items")}
                    />
                    <UploadCard
                      title="Catalogo Enerfluid (SKU + marca)"
                      fileName={uploadFiles.catalogo?.name || ""}
                      dbStatus={uploadDbStatus.catalogo}
                      updatedAt={formatDateTime(uploadLogsByType.get("catalogo")?.uploaded_at)}
                      status={uploadStatus.catalogo}
                      uploading={uploadLoading.catalogo}
                      onSelect={(event) =>
                        setUploadFiles((prev) => ({ ...prev, catalogo: event.target.files?.[0] || null }))
                      }
                      onUpload={() => handleUpload("catalogo")}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeView === "analysis" && (
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
                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => {
                        if (!itemsIndex) return;
                        const codes = filteredItems.map((item) => item.code);
                        setSelection((prev) => {
                          const next = new Set(prev);
                          codes.forEach((code) => next.add(code));
                          return next;
                        });
                      }}>Seleccionar filtrados</Button>
                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => {
                        if (!itemsIndex) return;
                        const codes = filteredItems.map((item) => item.code);
                        setSelection((prev) => {
                          const next = new Set(prev);
                          codes.forEach((code) => next.delete(code));
                          return next;
                        });
                      }}>Deseleccionar filtrados</Button>
                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => {
                        if (!itemsIndex) return;
                        setSelection(new Set(itemsIndex.items.map((item) => item.code)));
                      }}>Todos</Button>
                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => setSelection(new Set())}>Ninguno</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label className="block text-sm text-slate-600">
                    Buscar item
                    <Input value={itemFilter} onChange={(event) => setItemFilter(event.target.value)} placeholder="Ej: 0101 o filtro o marca" />
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
                          <span>{item.code} - {item.desc} ({item.brand})</span>
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
                  {!itemsTableRows.length && <p className="mt-3 text-sm text-slate-400">Sin items para los filtros actuales.</p>}
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
                        <div className="font-semibold text-slate-700">{inventorySeries ? formatCurrency(inventorySeries.lastValue) : "-"}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Unidades ultimo punto</div>
                        <div className="font-semibold text-slate-700">{inventorySeries ? Number(inventorySeries.lastUnits).toLocaleString("es-EC") : "-"}</div>
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
                    {unitsChartData && <Line data={unitsChartData} options={lineChartOptions} />}
                  </ChartWrap>
                  <ChartWrap title="Valor en USD" empty={!valueChartData}>
                    {valueChartData && <Line data={valueChartData} options={valueChartOptions} />}
                  </ChartWrap>
                </CardContent>
                <CardContent>
                  <p className="text-xs text-slate-400">El valor se calcula con el costo historico del movimiento (Total o CXUnidad).</p>
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
                      <Button size="sm" variant="ghost" onClick={() => setMotSelection(new Set(motives))}>Todos</Button>
                      <Button size="sm" variant="ghost" onClick={() => setMotSelection(new Set())}>Ninguno</Button>
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
                              <Badge variant="outline" className={getMovementSign(row) > 0 ? "text-emerald-600" : "text-rose-500"}>
                                {getMovementSign(row) > 0 ? "Ingreso" : "Egreso"}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">{row.item}</td>
                            <td className="px-3 py-2">{row.desc || "-"}</td>
                            <td className="px-3 py-2">{formatNumber(row.qty)}</td>
                            <td className="px-3 py-2">{formatCurrency(row.cxUnit)}</td>
                            <td className="px-3 py-2">{formatCurrency(row.total)}</td>
                            <td className="px-3 py-2">{Number.isFinite(row.pvpTotal) && Number.isFinite(row.qty) ? formatCurrency(Math.abs(row.pvpTotal) / Math.abs(row.qty)) : "-"}</td>
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
            </div>
          )}

          {activeView === "replenishment" && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>Necesidades de reposicion</CardTitle>
                    <CardDescription>
                      Compra cuando la cobertura cae por debajo del minimo (lead time + colchon) y repone al objetivo.
                    </CardDescription>
                  </div>
                  <div className="text-sm text-slate-500">
                    Items catalogo {replenishmentData?.rows?.length || 0}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-xs text-slate-600">
                      Ventana de consumo (meses)
                      <Input
                        type="number"
                        min="1"
                        value={consumptionWindowMonths}
                        onChange={(event) => setConsumptionWindowMonths(event.target.value)}
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      Lead time asumido (meses)
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={leadTimeMonths}
                        onChange={(event) => setLeadTimeMonths(event.target.value)}
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      Colchon (meses)
                      <Input
                        type="number"
                        min="0"
                        value={bufferMonths}
                        onChange={(event) => setBufferMonths(event.target.value)}
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      Objetivo de cobertura (meses)
                      <Input
                        type="number"
                        min="1"
                        value={targetCoverageMonths}
                        onChange={(event) => setTargetCoverageMonths(event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-mist px-4 py-3 text-xs text-slate-600">
                    <span>
                      Minimo para comprar:{" "}
                      <strong>{formatNumber(replenishmentData?.minCoverageMonths ?? 0, 1)} meses</strong>
                    </span>
                    <span className="text-slate-400">|</span>
                    <span>
                      Lead time: <strong>{formatNumber(replenishmentData?.leadTimeMonths ?? 0, 1)} meses</strong>
                    </span>
                    <span className="text-slate-400">|</span>
                    <span>
                      Objetivo:{" "}
                      <strong>{formatNumber(replenishmentData?.coverageTarget ?? 0, 1)} meses</strong>
                    </span>
                  </div>
                  <div className="rounded-2xl border border-line p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold">Motivos de consumo</span>
                      <Button size="sm" variant="ghost" onClick={() => setConsumptionMotSelection(new Set(motives))}>Todos</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConsumptionMotSelection(new Set())}>Ninguno</Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {motives.map((mot) => (
                        <label key={mot || "(vacio)"} className="flex items-center gap-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={consumptionMotSelection.has(mot)}
                            onChange={(event) => {
                              setConsumptionMotSelection((prev) => {
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
                  <div className="max-h-[420px] overflow-auto rounded-2xl border border-line">
                    <table className="w-full text-xs">
                      <thead className="bg-mist text-[11px] uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Item</th>
                          <th className="px-3 py-2 text-left">Descripcion</th>
                          <th className="px-3 py-2 text-left">Marca</th>
                          <th className="px-3 py-2 text-left">Stock actual</th>
                          <th className="px-3 py-2 text-left">Consumo (u)</th>
                          <th className="px-3 py-2 text-left">Meses con stock</th>
                          <th className="px-3 py-2 text-left">Consumo mensual</th>
                          <th className="px-3 py-2 text-left">Meses cobertura</th>
                          <th className="px-3 py-2 text-left">Min cobertura</th>
                          <th className="px-3 py-2 text-left">Comprar</th>
                          <th className="px-3 py-2 text-left">Reponer (u)</th>
                          <th className="px-3 py-2 text-left">Costo estimado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleReplenishmentRows.map((row) => (
                          <tr key={row.code} className="border-t border-slate-100">
                            <td className="px-3 py-2">{row.code}</td>
                            <td className="px-3 py-2">{row.desc || "-"}</td>
                            <td className="px-3 py-2">{row.brand || "-"}</td>
                            <td className="px-3 py-2">{formatNumber(row.stockCurrent)}</td>
                            <td className="px-3 py-2">{formatNumber(row.consumptionUnits)}</td>
                            <td className="px-3 py-2">{row.availableMonths === Infinity ? "8" : formatNumber(row.availableMonths, 1)}</td>
                            <td className="px-3 py-2">{formatNumber(row.consumptionMonthly, 2)}</td>
                            <td className="px-3 py-2">{row.monthsCoverage === Infinity ? "8" : formatNumber(row.monthsCoverage, 1)}</td>
                            <td className="px-3 py-2">{formatNumber(row.minCoverageMonths, 1)}</td>
                            <td className="px-3 py-2">
                              {row.shouldBuy ? (
                                <Badge variant="outline" className="text-amber-600">Comprar</Badge>
                              ) : (
                                <Badge variant="outline" className="text-slate-400">Ok</Badge>
                              )}
                            </td>
                            <td className="px-3 py-2">{formatNumber(row.qtyToBuy)}</td>
                            <td className="px-3 py-2">{formatCurrency(row.costEstimate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {replenishmentData?.rows?.length > visibleReplenishmentRows.length && (
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        Mostrando {visibleReplenishmentRows.length} de {replenishmentData.rows.length} items
                      </span>
                      <Button size="sm" variant="outline" onClick={() => setReplenishmentLimit((prev) => prev + 200)}>
                        Ver mas
                      </Button>
                    </div>
                  )}
                  {!replenishmentData?.rows?.length && <p className="text-sm text-slate-400">Sin datos para calcular reposicion.</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Resumen por marca</CardTitle>
                    <CardDescription>Agrupado por costo estimado con ultimo costo.</CardDescription>
                  </div>
                  <div className="text-sm text-slate-500">Marcas {replenishmentData?.brandRows?.length || 0}</div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[320px] overflow-auto rounded-2xl border border-line">
                    <table className="w-full text-xs">
                      <thead className="bg-mist text-[11px] uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Marca</th>
                          <th className="px-3 py-2 text-left">Items</th>
                          <th className="px-3 py-2 text-left">Reponer (u)</th>
                          <th className="px-3 py-2 text-left">Costo estimado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {replenishmentData?.brandRows?.map((row) => (
                          <tr
                            key={row.brand}
                            className="cursor-pointer border-t border-slate-100 hover:bg-mist"
                            onClick={() => setBrandModal({ open: true, brand: row.brand, rows: replenishmentData.rows.filter((item) => item.brand === row.brand) })}
                          >
                            <td className="px-3 py-2">{row.brand}</td>
                            <td className="px-3 py-2">{formatNumber(row.items)}</td>
                            <td className="px-3 py-2">{formatNumber(row.qty)}</td>
                            <td className="px-3 py-2">{formatCurrency(row.cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!replenishmentData?.brandRows?.length && <p className="text-sm text-slate-400">Sin marcas para mostrar.</p>}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <Dialog open={brandModal.open} onOpenChange={(open) => setBrandModal((prev) => ({ ...prev, open }))}>
        <DialogContent className="w-[96vw] max-w-6xl max-h-[90vh] overflow-y-auto">
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
            <DialogTitle>Detalle de marca: {brandModal.brand}</DialogTitle>
            <p className="text-sm text-slate-500">
              Ventana: {replenishmentData?.monthsWindow || "-"} meses | Lead time: {formatNumber(replenishmentData?.leadTimeMonths ?? 0, 1)} meses | Min: {formatNumber(replenishmentData?.minCoverageMonths ?? 0, 1)} meses | Objetivo: {formatNumber(replenishmentData?.coverageTarget ?? 0, 1)} meses
            </p>
          </DialogHeader>
          <div className="mt-4 max-h-[60vh] overflow-auto rounded-2xl border border-line">
            <table className="w-full text-xs">
              <thead className="bg-mist text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-left">Descripcion</th>
                  <th className="px-3 py-2 text-left">Stock actual</th>
                  <th className="px-3 py-2 text-left">Consumo (u)</th>
                  <th className="px-3 py-2 text-left">Meses con stock</th>
                  <th className="px-3 py-2 text-left">Consumo mensual</th>
                  <th className="px-3 py-2 text-left">Meses cobertura</th>
                  <th className="px-3 py-2 text-left">Reponer (u)</th>
                  <th className="px-3 py-2 text-left">Costo estimado</th>
                </tr>
              </thead>
              <tbody>
                {brandModal.rows?.map((row) => (
                  <tr
                    key={row.code}
                    className="cursor-pointer border-t border-slate-100 hover:bg-mist"
                    onClick={() => setItemModal({ open: true, item: itemsIndex?.items?.find((item) => item.code === row.code) || { code: row.code, desc: row.desc } })}
                  >
                    <td className="px-3 py-2">{row.code}</td>
                    <td className="px-3 py-2">{row.desc || "-"}</td>
                    <td className="px-3 py-2">{formatNumber(row.stockCurrent)}</td>
                    <td className="px-3 py-2">{formatNumber(row.consumptionUnits)}</td>
                    <td className="px-3 py-2">{row.availableMonths === Infinity ? "8" : formatNumber(row.availableMonths, 1)}</td>
                    <td className="px-3 py-2">{formatNumber(row.consumptionMonthly, 2)}</td>
                    <td className="px-3 py-2">{row.monthsCoverage === Infinity ? "8" : formatNumber(row.monthsCoverage, 1)}</td>
                    <td className="px-3 py-2">{formatNumber(row.qtyToBuy)}</td>
                    <td className="px-3 py-2">{formatCurrency(row.costEstimate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!brandModal.rows?.length && <p className="mt-3 text-sm text-slate-400">Sin items para esta marca.</p>}
        </DialogContent>
      </Dialog>

      <Dialog open={itemModal.open} onOpenChange={(open) => setItemModal((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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
            <DialogTitle>{itemModal.item ? `${itemModal.item.code} - ${itemModal.item.desc}` : "Detalle del item"}</DialogTitle>
            <p className="text-sm text-slate-500">{itemModalSubtitle}</p>
          </DialogHeader>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ChartWrap title="Unidades" empty={!itemUnitsChartData}>
              {itemUnitsChartData && itemModalSeries && <Line data={itemUnitsChartData} options={lineChartOptions} />}
            </ChartWrap>
            <ChartWrap title="Valor en USD" empty={!itemValueChartData}>
              {itemValueChartData && itemModalSeries && <Line data={itemValueChartData} options={valueChartOptions} />}
            </ChartWrap>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ChartWrap title="Precio vs costos (ventas)" empty={!itemSalesChartData}>
              {itemSalesChartData && <Line data={itemSalesChartData} options={itemSalesOptions} />}
            </ChartWrap>
            <ChartWrap title="Costos por proveedor" empty={!itemCostChartData}>
              {itemCostChartData && <Line data={itemCostChartData} options={itemCostOptions} />}
            </ChartWrap>
          </div>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Ventas por cliente (item)</CardTitle>
              <CardDescription>Top 10 clientes por anio para este item. El resto se agrupa en &quot;Otros&quot;.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {itemSalesByCustomerData ? (
                  <Bar data={itemSalesByCustomerData} options={customerStackedOptions} />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    Sin datos de ventas para graficar.
                  </div>
                )}
              </div>
              <CustomerLegend items={itemSalesByCustomerData?.legendItems} />
            </CardContent>
          </Card>
          <div className="mt-4 max-h-[260px] overflow-auto rounded-2xl border border-line">
            <table className="w-full text-xs">
              <thead className="bg-mist text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
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
                {itemMovements.map((row, idx) => (
                  <tr key={`${row.item}-${idx}`} className="border-t border-slate-100">
                    <td className="px-3 py-2">{row.date.toLocaleString("es-EC")}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={getMovementSign(row) > 0 ? "text-emerald-600" : "text-rose-500"}>
                        {getMovementSign(row) > 0 ? "Ingreso" : "Egreso"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{formatNumber(row.qty)}</td>
                    <td className="px-3 py-2">{formatCurrency(row.cxUnit)}</td>
                    <td className="px-3 py-2">{formatCurrency(row.total)}</td>
                    <td className="px-3 py-2">{Number.isFinite(row.pvpTotal) && Number.isFinite(row.qty) ? formatCurrency(Math.abs(row.pvpTotal) / Math.abs(row.qty)) : "-"}</td>
                    <td className="px-3 py-2">{formatCurrency(row.pvpTotal)}</td>
                    <td className="px-3 py-2">{row.mot || "-"}</td>
                    <td className="px-3 py-2">{row.referencia || "-"}</td>
                    <td className="px-3 py-2">{row.persona || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!itemMovements.length && <p className="mt-3 text-sm text-slate-400">Sin movimientos para este item.</p>}
        </DialogContent>
      </Dialog>
    </div>
  </div>
  );
}
