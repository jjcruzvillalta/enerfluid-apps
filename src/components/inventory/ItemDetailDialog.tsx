import React, { useMemo } from "react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChartWrap } from "@/components/inventory/ChartWrap";
import { CustomerLegend } from "@/components/inventory/CustomerLegend";
import {
  buildCostSeriesForItems,
  buildPoints,
  buildSalesPriceSeriesForItems,
  buildSeriesForItems,
  buildTopCustomersByYearData,
  formatCurrency,
  formatDate,
  formatNumber,
  formatTick,
  getMovementSign,
  getTimeUnit,
} from "@/lib/data";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
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
  type TimeUnit,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { X } from "lucide-react";

ChartJS.register(
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

type InventoryRange = { startDate?: Date; endDate?: Date };

type ItemDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: { code: string; desc?: string } | null;
  movements: any[];
  ventas: any[];
  inventoryPeriod: string;
  inventoryRange: InventoryRange;
};

const buildLineOptions = (period: string, labelFormatter: (value: number) => string): ChartOptions<"line"> => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index" as const, intersect: false },
  plugins: {
    legend: {
      labels: {
        color: "#0f172a",
        usePointStyle: true,
      },
    },
    tooltip: {
      callbacks: {
        title(items: any[]) {
          if (!items.length) return "";
          return new Date(items[0].parsed.x).toLocaleDateString("es-EC");
        },
        label(context: any) {
          return labelFormatter(context.parsed.y);
        },
      },
    },
  },
  scales: {
    x: {
      type: "time" as const,
      time: { unit: getTimeUnit(period) as TimeUnit },
      ticks: {
        color: "#64748b",
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 8,
        font: { size: 11 },
        callback: (value: any) => formatTick(value, period),
      },
      grid: { color: "rgba(15, 23, 42, 0.08)" },
    },
    y: {
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
        label(context: any) {
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

export const ItemDetailDialog = ({
  open,
  onOpenChange,
  item,
  movements,
  ventas,
  inventoryPeriod,
  inventoryRange,
}: ItemDetailDialogProps) => {
  const itemSeries = useMemo(() => {
    if (!item) return null;
    return buildSeriesForItems({
      movements,
      period: inventoryPeriod,
      startDate: inventoryRange.startDate,
      endDate: inventoryRange.endDate,
      itemsSet: new Set([item.code]),
    });
  }, [item, movements, inventoryPeriod, inventoryRange]);

  const itemSalesSeries = useMemo(() => {
    if (!item) return null;
    return buildSalesPriceSeriesForItems({
      ventasRows: ventas,
      period: inventoryPeriod,
      startDate: inventoryRange.startDate,
      endDate: inventoryRange.endDate,
      itemsSet: new Set([item.code]),
    });
  }, [item, ventas, inventoryPeriod, inventoryRange]);

  const itemCostSeries = useMemo(() => {
    if (!item) return null;
    return buildCostSeriesForItems({
      movements,
      period: inventoryPeriod,
      startDate: inventoryRange.startDate,
      endDate: inventoryRange.endDate,
      itemsSet: new Set([item.code]),
    });
  }, [item, movements, inventoryPeriod, inventoryRange]);

  const itemSalesByCustomerData = useMemo(() => {
    if (!item || !ventas?.length) return null;
    const rows = ventas.filter((row) => row.item === item.code);
    return buildTopCustomersByYearData(rows, 10, 10);
  }, [item, ventas]);

  const itemMovements = useMemo(() => {
    if (!item) return [];
    return movements
      .filter((row) => row.item === item.code)
      .sort((a, b) => b.date - a.date);
  }, [item, movements]);

  const itemUnitsChartData = itemSeries
    ? {
        datasets: [
          {
            label: "Unidades",
            data: buildPoints(itemSeries.dates, itemSeries.unitsSeries),
            borderColor: "#1f6feb",
            backgroundColor: "rgba(31, 111, 235, 0.18)",
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 2,
          },
        ],
      }
    : null;

  const itemValueChartData = itemSeries
    ? {
        datasets: [
          {
            label: "Valor (USD)",
            data: buildPoints(itemSeries.dates, itemSeries.valueSeries),
            borderColor: "#60a5fa",
            backgroundColor: "rgba(96, 165, 250, 0.18)",
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 2,
          },
        ],
      }
    : null;

  const itemSalesChartData = itemSalesSeries
    ? {
        datasets: [
          {
            label: "Precio",
            data: buildPoints(itemSalesSeries.periodDates, itemSalesSeries.priceSeries),
            borderColor: "#1f6feb",
            backgroundColor: "rgba(31, 111, 235, 0.18)",
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 2,
          },
          {
            label: "Costo",
            data: buildPoints(itemSalesSeries.periodDates, itemSalesSeries.costSeries),
            borderColor: "#f97316",
            backgroundColor: "rgba(249, 115, 22, 0.18)",
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 2,
          },
          {
            label: "Neto",
            data: buildPoints(itemSalesSeries.periodDates, itemSalesSeries.netSeries),
            borderColor: "#22c55e",
            backgroundColor: "rgba(34, 197, 94, 0.18)",
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 2,
          },
        ],
      }
    : null;

  const itemCostChartData = itemCostSeries
    ? {
        datasets: itemCostSeries.seriesList.map((series, index) => ({
          label: series.supplier,
          data: buildPoints(itemCostSeries.periodDates, series.values),
          borderColor: ["#1f6feb", "#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a855f7"][index % 6],
          backgroundColor: "rgba(0, 0, 0, 0)",
          tension: 0.25,
          borderWidth: 2,
          pointRadius: 2,
        })),
      }
    : null;

  const itemModalSubtitle = itemSeries
    ? `Rango: ${itemSeries.startDate ? formatDate(itemSeries.startDate) : "-"} a ${
        itemSeries.endDate ? formatDate(itemSeries.endDate) : "-"
      }`
    : "-";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <DialogTitle>{item ? `${item.code} - ${item.desc}` : "Detalle del item"}</DialogTitle>
          <p className="text-sm text-slate-500">{itemModalSubtitle}</p>
        </DialogHeader>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ChartWrap title="Unidades" empty={!itemUnitsChartData}>
            {itemUnitsChartData && <Line data={itemUnitsChartData} options={buildLineOptions(inventoryPeriod, (v) => formatNumber(v))} />}
          </ChartWrap>
          <ChartWrap title="Valor en USD" empty={!itemValueChartData}>
            {itemValueChartData && <Line data={itemValueChartData} options={buildLineOptions(inventoryPeriod, (v) => formatCurrency(v))} />}
          </ChartWrap>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ChartWrap title="Precio vs costos (ventas)" empty={!itemSalesChartData}>
            {itemSalesChartData && <Line data={itemSalesChartData} options={buildLineOptions(inventoryPeriod, (v) => formatCurrency(v))} />}
          </ChartWrap>
          <ChartWrap title="Costos por proveedor" empty={!itemCostChartData}>
            {itemCostChartData && <Line data={itemCostChartData} options={buildLineOptions(inventoryPeriod, (v) => formatCurrency(v))} />}
          </ChartWrap>
        </div>
        <div className="mt-4">
          <div className="rounded-2xl border border-line p-4">
            <h4 className="text-sm font-semibold text-ink">Ventas por cliente (item)</h4>
            <p className="text-xs text-slate-500">
              Top 10 clientes por anio para este item. El resto se agrupa en &quot;Otros&quot;.
            </p>
            <div className="mt-3 h-64">
              {itemSalesByCustomerData ? (
                <Bar data={itemSalesByCustomerData} options={customerStackedOptions as any} />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  Sin datos de ventas para graficar.
                </div>
              )}
            </div>
            <CustomerLegend items={itemSalesByCustomerData?.legendItems} />
          </div>
        </div>
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
        {!itemMovements.length && <p className="mt-3 text-sm text-slate-400">Sin movimientos para este item.</p>}
      </DialogContent>
    </Dialog>
  );
};
