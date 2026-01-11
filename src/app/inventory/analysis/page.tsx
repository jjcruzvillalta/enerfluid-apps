"use client";

import React, { useMemo, useState } from "react";
import { useInventory } from "@/context/InventoryContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Line, Pie } from "react-chartjs-2";
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
import { buildSeriesForItems, buildLineDistribution, buildPoints, formatTick, getTimeUnit } from "@/lib/data";

// Register ChartJS
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

// Helper for charts
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

const palette = [
    "#1f6feb", "#60a5fa", "#34d399", "#fbbf24", "#f87171",
    "#94a3b8", "#38bdf8", "#f97316", "#a855f7"
];

export default function AnalysisPage() {
    const { movements, itemsIndex, selection } = useInventory();

    const [period, setPeriod] = useState("month");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const selectedSet = useMemo(() => {
        if (!itemsIndex || !selection || selection.size === itemsIndex.items.length) return null;
        return selection;
    }, [itemsIndex, selection]);

    const inventoryRange = useMemo(() => {
        // Simple parse logic, improving on legacy
        return {
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate + "T23:59:59") : undefined
        };
    }, [startDate, endDate]);

    const inventorySeries = useMemo(() =>
        buildSeriesForItems({
            movements,
            period,
            ...inventoryRange,
            itemsSet: selectedSet || null,
        }),
        [movements, period, inventoryRange, selectedSet]);

    const lineDistribution = useMemo(() => buildLineDistribution(itemsIndex, selectedSet), [itemsIndex, selectedSet]);
    // Catalog share chart can be added later if needed.

    // Chart Configs
    const unitsChartData = inventorySeries ? {
        datasets: [{
            label: "Unidades",
            data: buildPoints(inventorySeries.dates, inventorySeries.unitsSeries),
            borderColor: "#1f6feb",
            backgroundColor: "rgba(31, 111, 235, 0.18)",
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 2
        }]
    } : null;

    const valueChartData = inventorySeries ? {
        datasets: [{
            label: "Valor (USD)",
            data: buildPoints(inventorySeries.dates, inventorySeries.valueSeries),
            borderColor: "#60a5fa",
            backgroundColor: "rgba(96, 165, 250, 0.18)",
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 2
        }]
    } : null;

    const lineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                type: "time",
                time: { unit: getTimeUnit(period) },
                ticks: { callback: (val) => formatTick(val, period) }
            }
        }
    };

    // Pie Data
    const linePieData = lineDistribution ? {
        labels: lineDistribution.map(d => d[0]),
        datasets: [{
            data: lineDistribution.map(d => d[1]),
            backgroundColor: palette
        }]
    } : null;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Analisis</h1>
                    <p className="text-slate-500">Visualizacion de tendencias y distribucion.</p>
                </div>
                <div className="flex gap-2">
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="day">Dia</SelectItem>
                            <SelectItem value="week">Semana</SelectItem>
                            <SelectItem value="month">Mes</SelectItem>
                            <SelectItem value="year">Ano</SelectItem>
                        </SelectContent>
                    </Select>
                    <Input type="date" className="w-auto" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    <Input type="date" className="w-auto" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <ChartWrap title="Evolucion de Unidades" empty={!inventorySeries}>
                    {unitsChartData && <Line data={unitsChartData} options={lineOptions as any} />}
                </ChartWrap>
                <ChartWrap title="Evolucion de Valor" empty={!inventorySeries}>
                    {valueChartData && <Line data={valueChartData} options={lineOptions as any} />}
                </ChartWrap>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <ChartWrap title="Distribucion por Linea" empty={!lineDistribution}>
                    {linePieData && <Pie data={linePieData} options={{ maintainAspectRatio: false }} />}
                </ChartWrap>
                {/* Add more charts here */}
            </div>
        </div>
    );
}
