"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useInventory } from "@/context/InventoryContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ItemDetailDialog } from "@/components/inventory/ItemDetailDialog";
import { buildReplenishmentData } from "@/lib/replenishment";
import { formatCurrency, formatNumber, getRowsDateRange } from "@/lib/data";
import { X } from "lucide-react";

export default function ReplenishmentPage() {
  const { itemsIndex, movements, ventas } = useInventory();

  const [consumptionWindowMonths, setConsumptionWindowMonths] = useState(24);
  const [targetCoverageMonths, setTargetCoverageMonths] = useState(6);
  const [leadTimeMonths, setLeadTimeMonths] = useState(2);
  const [bufferMonths, setBufferMonths] = useState(1);
  const [replenishmentLimit, setReplenishmentLimit] = useState(200);

  const [consumptionMotSelection, setConsumptionMotSelection] = useState<Set<string>>(new Set());
  const [brandModal, setBrandModal] = useState({ open: false, brand: "", rows: [] });
  const [itemModal, setItemModal] = useState({ open: false, item: null });

  const [inventoryPeriod] = useState("month");
  const [inventoryRange, setInventoryRange] = useState({ startDate: undefined, endDate: undefined });

  const formatCoverage = (value, digits = 1) =>
    Number.isFinite(value) ? formatNumber(value, digits) : "Sin consumo";

  const motives = useMemo((): string[] => {
    const set = new Set<string>();
    movements.forEach((row) => {
      if (row.mot !== undefined) set.add(String(row.mot || ""));
    });
    return Array.from(set).sort();
  }, [movements]);

  const replenishmentData = useMemo(
    () =>
      buildReplenishmentData({
        itemsIndex,
        movements,
        selectedSet: null,
        monthsWindow: Math.max(1, Number(consumptionWindowMonths) || 12),
        targetMonths: Math.max(0, Number(targetCoverageMonths) || 0),
        leadTimeMonths: Math.max(0, Number(leadTimeMonths) || 0),
        bufferMonths: Math.max(0, Number(bufferMonths) || 0),
        selectedMotives:
          consumptionMotSelection.size && consumptionMotSelection.size !== motives.length
            ? consumptionMotSelection
            : null,
      }),
    [
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

  useEffect(() => {
    if (!motives.length) return;
    setConsumptionMotSelection(new Set(motives));
  }, [motives]);

  useEffect(() => {
    const total = replenishmentData?.rows?.length || 0;
    if (!total) {
      setReplenishmentLimit(200);
      return;
    }
    setReplenishmentLimit((prev) => Math.min(prev, total) || 200);
  }, [replenishmentData]);

  useEffect(() => {
    if (!movements.length) return;
    const range = getRowsDateRange(movements);
    if (!range) return;
    setInventoryRange({ startDate: range.minDate, endDate: range.maxDate });
  }, [movements]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Necesidades de reposicion</CardTitle>
            <CardDescription>
              Compra cuando la cobertura cae por debajo del minimo (lead time + colchon) y repone al objetivo.
            </CardDescription>
          </div>
          <div className="text-sm text-slate-500">Items catalogo {replenishmentData?.rows?.length || 0}</div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-slate-600">
              Ventana de consumo (meses)
              <Input
                type="number"
                min="1"
                value={consumptionWindowMonths}
                onChange={(event) => setConsumptionWindowMonths(Number(event.target.value))}
              />
            </label>
            <label className="text-xs text-slate-600">
              Lead time asumido (meses)
              <Input
                type="number"
                min="0"
                step="0.1"
                value={leadTimeMonths}
                onChange={(event) => setLeadTimeMonths(Number(event.target.value))}
              />
            </label>
            <label className="text-xs text-slate-600">
              Colchon (meses)
              <Input
                type="number"
                min="0"
                value={bufferMonths}
                onChange={(event) => setBufferMonths(Number(event.target.value))}
              />
            </label>
            <label className="text-xs text-slate-600">
              Objetivo de cobertura (meses)
              <Input
                type="number"
                min="1"
                value={targetCoverageMonths}
                onChange={(event) => setTargetCoverageMonths(Number(event.target.value))}
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
              Objetivo: <strong>{formatNumber(replenishmentData?.coverageTarget ?? 0, 1)} meses</strong>
            </span>
          </div>
          <div className="rounded-2xl border border-line p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold">Motivos de consumo</span>
              <Button size="sm" variant="ghost" onClick={() => setConsumptionMotSelection(new Set(motives))}>
                Todos
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConsumptionMotSelection(new Set())}>
                Ninguno
              </Button>
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
                    <td className="px-3 py-2">
                      {formatCoverage(row.availableMonths, 1)}
                    </td>
                    <td className="px-3 py-2">{formatNumber(row.consumptionMonthly, 2)}</td>
                    <td className="px-3 py-2">
                      {formatCoverage(row.monthsCoverage, 1)}
                    </td>
                    <td className="px-3 py-2">{formatNumber(row.minCoverageMonths, 1)}</td>
                    <td className="px-3 py-2">
                      {row.shouldBuy ? (
                        <Badge variant="outline" className="text-amber-600">
                          Comprar
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-400">
                          Ok
                        </Badge>
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
          {!replenishmentData?.rows?.length && (
            <p className="text-sm text-slate-400">Sin datos para calcular reposicion.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                    onClick={() =>
                      setBrandModal({
                        open: true,
                        brand: row.brand,
                        rows: replenishmentData.rows.filter((item) => item.brand === row.brand),
                      })
                    }
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
                    onClick={() =>
                      setItemModal({
                        open: true,
                        item:
                          itemsIndex?.items?.find((item) => item.code === row.code) || {
                            code: row.code,
                            desc: row.desc,
                          },
                      })
                    }
                  >
                    <td className="px-3 py-2">{row.code}</td>
                    <td className="px-3 py-2">{row.desc || "-"}</td>
                    <td className="px-3 py-2">{formatNumber(row.stockCurrent)}</td>
                    <td className="px-3 py-2">{formatNumber(row.consumptionUnits)}</td>
                    <td className="px-3 py-2">
                      {formatCoverage(row.availableMonths, 1)}
                    </td>
                    <td className="px-3 py-2">{formatNumber(row.consumptionMonthly, 2)}</td>
                    <td className="px-3 py-2">
                      {formatCoverage(row.monthsCoverage, 1)}
                    </td>
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
