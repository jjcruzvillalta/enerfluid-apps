import * as XLSX from "xlsx";

export const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return NaN;
  const num = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(num) ? num : NaN;
};

export const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export const parseExcelDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 86400000);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const readWorkbookFromArrayBuffer = (buffer) => XLSX.read(buffer, { type: "array" });

export const readSheetRows = (workbook) => {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: null });
};

export const loadFromFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(readWorkbookFromArrayBuffer(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });

export const normalizeKey = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .trim();

export const getField = (row, options) => {
  for (const key of options) {
    if (row[key] !== undefined) return row[key];
    const target = normalizeKey(key);
    for (const rowKey of Object.keys(row)) {
      if (normalizeKey(rowKey) === target) return row[rowKey];
    }
  }
  return null;
};

export const buildUploadRows = (type, rows) => {
  if (type === "movimientos") {
    return rows
      .map((row) => {
        const date = parseExcelDate(getField(row, ["Emision", "Fecha"]));
        const item = String(getField(row, ["Item", "Codigo", "C?digo"]) || "").trim();
        if (!date || !item) return null;
        return {
          date: date.toISOString(),
          item,
          descripcion: String(getField(row, ["Descripcion", "Descripci?n"]) || "").trim(),
          cantidad: toNumber(getField(row, ["Cantidad"])),
          total: toNumber(getField(row, ["Total"])),
          cx_unit: toNumber(getField(row, ["CXUnidad", "CostoUnidad", "Costo Unitario"])),
          pvp_total: toNumber(getField(row, ["PVPTotal", "PVP Total", "PVPtotal"])),
          referencia: String(getField(row, ["Referencia"]) || "").trim(),
          persona: String(getField(row, ["Persona"]) || "").trim(),
          mot: String(getField(row, ["Mot"]) || "").trim(),
          tipo_movimiento: String(getField(row, ["TipoMovimiento"]) || "").trim(),
        };
      })
      .filter(Boolean);
  }
  if (type === "ventas") {
    return rows
      .map((row) => {
        const date = parseExcelDate(getField(row, ["Emision", "Fecha"]));
        const item = String(getField(row, ["ItemCodigo", "Item", "Codigo"]) || "").trim();
        if (!date || !item) return null;
        return {
          date: date.toISOString(),
          item,
          unidades: toNumber(getField(row, ["Unidades", "Cantidad"])),
          venta_bruta: toNumber(getField(row, ["VentaBruta", "Venta Bruta"])),
          costo_total: toNumber(getField(row, ["CostoTotal", "Costo Total"])),
          descuento_total: toNumber(getField(row, ["Total Descuento", "Descuento Total"])),
          persona: String(
            getField(row, ["Persona", "Cliente", "Cliente Nombre", "Nombre Cliente", "ClienteNombre", "cliente"]) || ""
          ).trim(),
        };
      })
      .filter(Boolean);
  }
  if (type === "items") {
    return rows
      .map((row) => {
        const code = String(getField(row, ["C?digo", "Codigo", "Item", "code", "codigo", "item", "sku"]) || "").trim();
        if (!code) return null;
        return {
          code,
          descripcion: String(getField(row, ["Descripci?n", "Descripcion", "Desc", "Nombre"]) || "").trim(),
          stock_total: toNumber(getField(row, ["StockTotal", "Stock", "Existencia"])),
          costo_promedio: toNumber(getField(row, ["CostoPromedio", "Costo Promedio"])),
          ultimo_costo: toNumber(getField(row, ["UltimoCosto", "Ultimo Costo", "Ultimo Costo Unitario"])),
          costo_reposicion: toNumber(getField(row, ["CostoReposicion", "Costo Reposicion"])),
          marca: String(getField(row, ["Marca", "Marca Visual", "Marca Real"]) || "").trim(),
          linea: String(getField(row, ["Linea", "L?nea", "LineaDescripcionAlterna", "SubLinea", "linea"]) || "").trim(),
          pvp1: toNumber(getField(row, ["PVP1", "PVP 1", "PVP1+IVA", "PVP2", "PVP2+IVA"])),
        };
      })
      .filter(Boolean);
  }
  if (type === "catalogo") {
    return rows
      .map((row) => {
        const sku = String(getField(row, ["SKU", "Sku", "Codigo", "C?digo", "sku", "codigo"]) || "").trim();
        if (!sku) return null;
        return {
          sku,
          nombre: String(getField(row, ["Nombre", "Descripcion", "Descripci?n", "nombre", "descripcion"]) || "").trim(),
          marca_visual: String(getField(row, ["Marca Visual", "Marca"]) || "").trim(),
          marca_real: String(getField(row, ["Marca Real"]) || "").trim(),
        };
      })
      .filter(Boolean);
  }
  return [];
};

export const parseMovements = (rows) =>
  (rows || [])
    .map((row) => ({
      date: parseExcelDate(row.date) || parseExcelDate(getField(row, ["Fecha", "Emision"])),
      item: String(row.item || row.Item || "").trim(),
      desc: String(row.descripcion || row.Descripcion || "").trim(),
      qty: toNumber(row.cantidad ?? row.Cantidad),
      total: toNumber(row.total ?? row.Total),
      cxUnit: toNumber(row.cx_unit ?? row.CXUnidad ?? row.CostoUnidad ?? row["Costo Unitario"]),
      pvpTotal: toNumber(row.pvp_total ?? row.PVPTotal ?? row["PVP Total"]),
      referencia: String(row.referencia || row.Referencia || "").trim(),
      persona: String(row.persona || row.Persona || "").trim(),
      mot: String(row.mot || row.Mot || "").trim(),
      type: String(row.tipo_movimiento || row.TipoMovimiento || "").trim(),
    }))
    .filter((row) => row.date && row.item);

export const parseVentas = (rows) =>
  (rows || [])
    .map((row) => ({
      date: parseExcelDate(row.date) || parseExcelDate(getField(row, ["Fecha", "Emision"])),
      item: String(row.item || row.Item || "").trim(),
      unidades: toNumber(row.unidades ?? row.Unidades ?? row.Cantidad),
      ventaBruta: toNumber(row.venta_bruta ?? row.VentaBruta ?? row["Venta Bruta"]),
      costoTotal: toNumber(row.costo_total ?? row.CostoTotal ?? row["Costo Total"]),
      descuentoTotal: toNumber(row.descuento_total ?? row["Descuento Total"] ?? row["Total Descuento"]),
      persona: String(
        row.persona ||
          row.Persona ||
          row.cliente ||
          row.Cliente ||
          getField(row, ["Persona", "Cliente", "Cliente Nombre", "Nombre Cliente", "ClienteNombre", "cliente"]) ||
          ""
      ).trim(),
    }))
    .filter((row) => row.date && row.item);

export const getMovementSign = (row) => {
  const type = normalizeText(row.type);
  if (type.includes("egreso") || type.includes("salida")) return -1;
  if (type.includes("ingreso") || type.includes("entrada")) return 1;
  if (Number.isFinite(row.qty) && row.qty < 0) return -1;
  if (Number.isFinite(row.total) && row.total < 0) return -1;
  return 1;
};

export const getRowsDateRange = (rows) => {
  if (!rows || !rows.length) return null;
  let minDate = rows[0].date;
  let maxDate = rows[0].date;
  rows.forEach((row) => {
    if (row.date < minDate) minDate = row.date;
    if (row.date > maxDate) maxDate = row.date;
  });
  return { minDate, maxDate };
};

export const isoWeek = (date) => {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((temp - yearStart) / 86400000 + 1) / 7);
  return { year: temp.getUTCFullYear(), week };
};

export const getPeriodKey = (date, period) => {
  if (period === "day") return date.toISOString().slice(0, 10);
  if (period === "week") {
    const w = isoWeek(date);
    return `${w.year}-W${String(w.week).padStart(2, "0")}`;
  }
  if (period === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${date.getFullYear()}`;
};

export const periodStartDate = (key, period) => {
  if (period === "day") return new Date(`${key}T00:00:00`);
  if (period === "week") {
    const [year, wk] = key.split("-W");
    const week = Number(wk);
    const simple = new Date(Date.UTC(Number(year), 0, 1 + (week - 1) * 7));
    const dayOfWeek = simple.getUTCDay();
    const isoWeekStart = new Date(simple);
    if (dayOfWeek <= 4) {
      isoWeekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
    } else {
      isoWeekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
    }
    return new Date(isoWeekStart.getTime());
  }
  if (period === "month") {
    const [year, month] = key.split("-");
    return new Date(Number(year), Number(month) - 1, 1);
  }
  return new Date(Number(key), 0, 1);
};

export const formatCurrency = (value) => {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const buildCatalogIndex = (rows) => {
  const map = new Map();
  (rows || []).forEach((row) => {
    const rawCode = getField(row, ["SKU", "Sku", "Codigo", "C?digo", "sku", "codigo"]);
    const code = String(rawCode ?? row.sku ?? row.codigo ?? row.code ?? "").trim();
    if (!code) return;
    const name = String(getField(row, ["Nombre", "Descripcion", "Descripci?n", "nombre", "descripcion"]) || "").trim();
    const brand =
      String(getField(row, ["Marca Visual", "Marca Real", "Marca", "marca_visual", "marca_real", "marca"]) || "").trim() ||
      "Sin marca";
    map.set(code, { code, name, brand });
  });
  return map;
};

export const buildItemsIndex = (rows, catalogIndex) => {
  const items = [];
  const costMap = new Map();

  (rows || []).forEach((row) => {
    const rawCode = getField(row, ["C?digo", "Codigo", "Item", "code", "codigo", "item", "sku"]);
    const code = String(rawCode ?? row.code ?? row.codigo ?? row.item ?? row.sku ?? "").trim();
    if (!code) return;

    const desc = String(getField(row, ["Descripci?n", "Descripcion", "descripcion", "desc", "nombre"]) || "").trim();
    const stock = toNumber(getField(row, ["StockTotal", "Stock", "stock_total", "stock"]));
    const costoPromedio = toNumber(getField(row, ["CostoPromedio", "Costo Promedio", "costo_promedio"]));
    const ultimoCosto = toNumber(getField(row, ["UltimoCosto", "Ultimo Costo", "ultimo_costo"]));
    const reposicion = toNumber(getField(row, ["CostoReposicion", "Costo Reposicion", "costo_reposicion"]));
    const marcaLista = String(getField(row, ["Marca", "marca"]) || "").trim();
    const line = String(getField(row, ["Linea", "L?nea", "LineaDescripcionAlterna", "SubLinea", "linea"]) || "Sin linea").trim();
    const pvp = toNumber(getField(row, ["PVP1", "PVP1+IVA", "PVP2", "PVP2+IVA", "pvp1"]));

    const costo = Number.isFinite(costoPromedio)
      ? costoPromedio
      : Number.isFinite(ultimoCosto)
        ? ultimoCosto
        : Number.isFinite(reposicion)
          ? reposicion
          : 0;

    costMap.set(code, costo);

    const catalogEntry = catalogIndex ? catalogIndex.get(code) : null;
    const brand = catalogEntry?.brand || marcaLista || "Sin marca";
    const finalDesc = catalogEntry?.name || desc;
    const isCatalog = Boolean(catalogEntry);

    items.push({
      code,
      desc: finalDesc,
      brand,
      isCatalog,
      line,
      pvp: Number.isFinite(pvp) ? pvp : NaN,
      stock: Number.isFinite(stock) ? stock : 0,
      cost: Number.isFinite(costo) ? costo : 0,
      lastCost: Number.isFinite(ultimoCosto) ? ultimoCosto : NaN,
    });
  });

  return { items, costMap };
};

export const buildSeriesForItems = ({ movements, period, startDate, endDate, itemsSet }) => {
  if (!movements?.length) return null;
  const resolvedPeriod = period || "month";
  const filteredMovements = movements
    .filter((row) => !itemsSet || itemsSet.has(row.item))
    .sort((a, b) => a.date - b.date);
  if (!filteredMovements.length) return null;

  const dataStart = filteredMovements[0].date;
  const dataEnd = filteredMovements[filteredMovements.length - 1].date;
  const rangeStart = startDate || dataStart;
  const rangeEnd = endDate || dataEnd;

  const bucketed = new Map();
  filteredMovements.forEach((row) => {
    if (rangeEnd && row.date > rangeEnd) return;
    const qty = Number.isFinite(row.qty) ? Math.abs(row.qty) : 0;
    const sign = getMovementSign(row);
    const total = Number.isFinite(row.total)
      ? Math.abs(row.total)
      : Number.isFinite(row.cxUnit)
        ? Math.abs(row.cxUnit) * qty
        : 0;
    const deltaUnits = qty * sign;
    const deltaValue = total * sign;

    const key = getPeriodKey(row.date, resolvedPeriod);
    const entry = bucketed.get(key) || { units: 0, value: 0 };
    entry.units += deltaUnits;
    entry.value += deltaValue;
    bucketed.set(key, entry);
  });

  const keys = [...bucketed.keys()].sort((a, b) => periodStartDate(a, resolvedPeriod) - periodStartDate(b, resolvedPeriod));
  const labels = [];
  const dates = [];
  const unitsSeries = [];
  const valueSeries = [];

  let units = 0;
  let value = 0;

  const startKey = rangeStart ? getPeriodKey(rangeStart, resolvedPeriod) : null;
  const endKey = rangeEnd ? getPeriodKey(rangeEnd, resolvedPeriod) : null;
  const startKeyDate = startKey ? periodStartDate(startKey, resolvedPeriod) : null;
  const endKeyDate = endKey ? periodStartDate(endKey, resolvedPeriod) : null;

  keys.forEach((key) => {
    const entry = bucketed.get(key);
    units += entry.units;
    value += entry.value;
    const keyDate = periodStartDate(key, resolvedPeriod);
    const afterStart = !startKeyDate || keyDate >= startKeyDate;
    const beforeEnd = !endKeyDate || keyDate <= endKeyDate;
    if (afterStart && beforeEnd) {
      labels.push(key);
      dates.push(keyDate);
      unitsSeries.push(units);
      valueSeries.push(value);
    }
  });

  return {
    labels,
    dates,
    unitsSeries,
    valueSeries,
    startDate: rangeStart,
    endDate: rangeEnd,
    lastUnits: unitsSeries[unitsSeries.length - 1] ?? 0,
    lastValue: valueSeries[valueSeries.length - 1] ?? 0,
    period: resolvedPeriod,
  };
};

export const buildCostSeriesForItems = ({ movements, period, startDate, endDate, itemsSet }) => {
  if (!movements?.length) return null;
  const resolvedPeriod = period || "month";
  const rows = movements
    .filter((row) => (!itemsSet || itemsSet.has(row.item)))
    .filter((row) => getMovementSign(row) > 0);

  if (!rows.length) return null;
  const dateRange = getRowsDateRange(rows);
  const rangeStart = startDate || dateRange.minDate;
  const rangeEnd = endDate || dateRange.maxDate;

  const buckets = new Map();
  const totalsBySupplier = new Map();

  rows.forEach((row) => {
    if (rangeStart && row.date < rangeStart) return;
    if (rangeEnd && row.date > rangeEnd) return;
    const qty = Number.isFinite(row.qty) ? Math.abs(row.qty) : 0;
    if (!qty) return;
    let unitCost = NaN;
    if (Number.isFinite(row.cxUnit) && row.cxUnit !== 0) {
      unitCost = Math.abs(row.cxUnit);
    } else if (Number.isFinite(row.total)) {
      unitCost = Math.abs(row.total) / qty;
    }
    if (!Number.isFinite(unitCost) || unitCost <= 0) return;

    const supplier = row.persona || row.referencia || "Sin proveedor";
    const key = getPeriodKey(row.date, resolvedPeriod);
    if (!buckets.has(key)) buckets.set(key, new Map());
    const map = buckets.get(key);
    const entry = map.get(supplier) || { sumCost: 0, sumQty: 0 };
    entry.sumCost += unitCost * qty;
    entry.sumQty += qty;
    map.set(supplier, entry);

    totalsBySupplier.set(supplier, (totalsBySupplier.get(supplier) || 0) + qty);
  });

  const periods = [...buckets.keys()].sort(
    (a, b) => periodStartDate(a, resolvedPeriod) - periodStartDate(b, resolvedPeriod)
  );
  const periodDates = periods.map((key) => periodStartDate(key, resolvedPeriod));

  const topSuppliers = [...totalsBySupplier.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name]) => name);

  const seriesList = topSuppliers.map((supplier, index) => {
    const values = periods.map((key) => {
      const entry = buckets.get(key)?.get(supplier);
      return entry && entry.sumQty ? entry.sumCost / entry.sumQty : null;
    });
    return { supplier, values, colorIndex: index };
  });

  return { periods, periodDates, seriesList, period: resolvedPeriod };
};

export const buildSalesPriceSeriesForItems = ({ ventasRows, period, startDate, endDate, itemsSet }) => {
  if (!ventasRows?.length) return null;
  const resolvedPeriod = period || "month";
  const rows = ventasRows.filter((row) => (!itemsSet || itemsSet.has(row.item)));
  if (!rows.length) return null;

  const dateRange = getRowsDateRange(rows);
  const rangeStart = startDate || dateRange.minDate;
  const rangeEnd = endDate || dateRange.maxDate;

  const buckets = new Map();
  rows.forEach((row) => {
    if (rangeStart && row.date < rangeStart) return;
    if (rangeEnd && row.date > rangeEnd) return;
    const units = Number.isFinite(row.unidades) ? Math.abs(row.unidades) : 0;
    if (!units) return;
    const priceUnit = Number.isFinite(row.ventaBruta) ? row.ventaBruta / units : NaN;
    const costUnit = Number.isFinite(row.costoTotal) ? row.costoTotal / units : NaN;
    const discountUnit = Number.isFinite(row.descuentoTotal) ? row.descuentoTotal / units : NaN;
    const netUnit = Number.isFinite(priceUnit) ? priceUnit - (Number.isFinite(discountUnit) ? discountUnit : 0) : NaN;
    const key = getPeriodKey(row.date, resolvedPeriod);
    const entry = buckets.get(key) || {
      priceSum: 0,
      priceUnits: 0,
      costSum: 0,
      costUnits: 0,
      netSum: 0,
      netUnits: 0,
    };
    if (Number.isFinite(priceUnit)) {
      entry.priceSum += priceUnit * units;
      entry.priceUnits += units;
    }
    if (Number.isFinite(costUnit)) {
      entry.costSum += costUnit * units;
      entry.costUnits += units;
    }
    if (Number.isFinite(netUnit)) {
      entry.netSum += netUnit * units;
      entry.netUnits += units;
    }
    buckets.set(key, entry);
  });

  const periods = [...buckets.keys()].sort(
    (a, b) => periodStartDate(a, resolvedPeriod) - periodStartDate(b, resolvedPeriod)
  );
  const periodDates = periods.map((key) => periodStartDate(key, resolvedPeriod));
  const priceSeries = periods.map((key) => {
    const entry = buckets.get(key);
    return entry.priceUnits ? entry.priceSum / entry.priceUnits : null;
  });
  const costSeries = periods.map((key) => {
    const entry = buckets.get(key);
    return entry.costUnits ? entry.costSum / entry.costUnits : null;
  });
  const netSeries = periods.map((key) => {
    const entry = buckets.get(key);
    return entry.netUnits ? entry.netSum / entry.netUnits : null;
  });

  return { periods, periodDates, priceSeries, costSeries, netSeries, period: resolvedPeriod };
};
