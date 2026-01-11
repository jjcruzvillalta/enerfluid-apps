
import { getMovementSign } from "./data";

export const buildReplenishmentData = ({
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

    const addMonths = (date, months) => {
        const next = new Date(date);
        next.setMonth(next.getMonth() + months);
        return next;
    };

    const addDays = (date, days) => {
        const next = new Date(date);
        next.setDate(next.getDate() + days);
        return next;
    };

    const formatDate = (date) => date.toISOString().slice(0, 10);

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
        const availableMonths = availableDays > 0 ? availableDays / 30 : 0;
        // Fix division by zero protection and logic
        const consumptionMonthly = availableMonths > 0.5 ? consumptionUnits / availableMonths : 0; // Require at least 0.5 month of data? Keep legacy logic.

        // Legacy logic:
        // const availableMonths = availableDays / 30;
        // const consumptionMonthly = availableMonths > 0 ? consumptionUnits / availableMonths : 0;

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
