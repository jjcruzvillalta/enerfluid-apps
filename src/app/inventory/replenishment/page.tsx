"use client";

import React, { useMemo, useState } from "react";
import { useInventory } from "@/context/InventoryContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { buildReplenishmentData } from "@/lib/replenishment";
import { formatCurrency } from "@/lib/data";

export default function ReplenishmentPage() {
    const {
        itemsIndex,
        movements,
        selection, // Using selection as selectedSet
        // Motives not in context yet? We might need to extract motives from movements or store in context. 
        // For now, let's assume all motives.
    } = useInventory();

    // Settings state
    const [monthsWindow, setMonthsWindow] = useState(12);
    const [targetCoverageMonths, setTargetCoverageMonths] = useState(12);
    const [leadTimeMonths, setLeadTimeMonths] = useState(1.5);
    const [bufferMonths, setBufferMonths] = useState(3);

    // Data processing
    const selectedSet = useMemo(() => {
        if (!itemsIndex || !selection || selection.size === itemsIndex.items.length) return null;
        return selection;
    }, [itemsIndex, selection]);

    const replenishmentData = useMemo(() =>
        buildReplenishmentData({
            itemsIndex,
            movements,
            selectedSet,
            monthsWindow,
            targetMonths: targetCoverageMonths,
            leadTimeMonths,
            bufferMonths,
            selectedMotives: null // TODO: Add motive selection support
        }),
        [itemsIndex, movements, selectedSet, monthsWindow, targetCoverageMonths, leadTimeMonths, bufferMonths]);

    const rows = replenishmentData?.rows || [];
    const brandRows = replenishmentData?.brandRows || [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Reposicion</h1>
                    <p className="text-slate-500">Calculo de compras sugeridas basado en historicos.</p>
                </div>
            </div>

            {/* Params Card */}
            <Card className="p-4 grid gap-4 md:grid-cols-4">
                <div>
                    <label className="text-xs font-semibold text-slate-500">Ventana Historica (Meses)</label>
                    <Input type="number" value={monthsWindow} onChange={e => setMonthsWindow(Number(e.target.value))} />
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-500">Cobertura Objetivo (Meses)</label>
                    <Input type="number" value={targetCoverageMonths} onChange={e => setTargetCoverageMonths(Number(e.target.value))} />
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-500">Lead Time (Meses)</label>
                    <Input type="number" value={leadTimeMonths} onChange={e => setLeadTimeMonths(Number(e.target.value))} />
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-500">Buffer (Meses)</label>
                    <Input type="number" value={bufferMonths} onChange={e => setBufferMonths(Number(e.target.value))} />
                </div>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">

                {/* Items Table */}
                <Card className="p-4 overflow-hidden">
                    <h3 className="font-semibold mb-4">Detalle por Item</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                <tr>
                                    <th className="px-3 py-2">Codigo</th>
                                    <th className="px-3 py-2">Stock</th>
                                    <th className="px-3 py-2">Consumo Mes</th>
                                    <th className="px-3 py-2">Cobertura</th>
                                    <th className="px-3 py-2 text-right">Sugerido</th>
                                    <th className="px-3 py-2 text-right">Costo Est.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {rows.slice(0, 50).map((row) => (
                                    <tr key={row.code} className={`hover:bg-slate-50 ${row.shouldBuy ? 'bg-blue-50/30' : ''}`}>
                                        <td className="px-3 py-2 font-medium">{row.code} <div className="text-[10px] text-slate-400 truncate w-32">{row.desc}</div></td>
                                        <td className="px-3 py-2">{row.stockCurrent.toFixed(0)}</td>
                                        <td className="px-3 py-2">{row.consumptionMonthly.toFixed(1)}</td>
                                        <td className="px-3 py-2">
                                            <Badge variant={row.monthsCoverage < row.minCoverageMonths ? "destructive" : "outline"}>
                                                {Number.isFinite(row.monthsCoverage) ? row.monthsCoverage.toFixed(1) : "Inf"} m
                                            </Badge>
                                        </td>
                                        <td className="px-3 py-2 text-right font-bold text-blue-600">
                                            {row.qtyToBuy > 0 ? formatCurrency(row.qtyToBuy).replace('$', '') : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-right text-slate-600">
                                            {row.qtyToBuy > 0 ? formatCurrency(row.costEstimate) : '-'}
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr><td colSpan={6} className="p-4 text-center text-slate-400">Sin datos</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {rows.length > 50 && <div className="p-2 text-center text-xs text-slate-400">Mostrando primeros 50 de {rows.length} items</div>}
                </Card>

                {/* Brand Summary */}
                <Card className="p-4 h-fit">
                    <h3 className="font-semibold mb-4">Resumen por Marca</h3>
                    <div className="space-y-3">
                        {brandRows.map((brand) => (
                            <div key={brand.brand} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                                <div>
                                    <p className="font-medium">{brand.brand}</p>
                                    <p className="text-xs text-slate-500">{brand.items} items a pedir</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-slate-700">{formatCurrency(brand.cost)}</p>
                                    <p className="text-xs text-slate-500">{brand.qty.toLocaleString()} unid.</p>
                                </div>
                            </div>
                        ))}
                        {brandRows.length === 0 && <p className="text-sm text-slate-400">Sin sugerencias de compra.</p>}
                    </div>
                </Card>
            </div>
        </div>
    );
}
