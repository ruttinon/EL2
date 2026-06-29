/** Report date range + formula evaluation (shared by engine export and editor preview). */
export const REPORT_BILLING_FORMULA_TOKENS = [
    { token: '@totalKwh', label: 'Total kWh' },
    { token: '@energyCost', label: 'Energy cost' },
    { token: '@demandCost', label: 'Demand cost' },
    { token: '@vat', label: 'VAT' },
    { token: '@grandTotal', label: 'Grand total' },
    { token: '@peakKw', label: 'Peak kW' },
    { token: '@rate', label: 'Rate per kWh (site)' },
];
export const REPORT_TAG_FORMULA_TOKENS = [
    { token: '@first', label: 'First reading (primary tag)' },
    { token: '@last', label: 'Last reading (primary tag)' },
    { token: '@usage', label: 'Usage Δ (primary tag)' },
    { token: '@amount', label: 'Cost for primary usage' },
    { token: '@A.first', label: 'Tag A — first' },
    { token: '@A.last', label: 'Tag A — last' },
    { token: '@A.usage', label: 'Tag A — usage' },
    { token: '@B.first', label: 'Tag B — first' },
    { token: '@B.last', label: 'Tag B — last' },
    { token: '@B.usage', label: 'Tag B — usage' },
];
const FORMULA_SAFE = /^[\d\s.+\-*/()eE]+$/;
export function isEnergyLikeTag(unit, tagName) {
    const u = String(unit ?? '').toLowerCase();
    const n = String(tagName ?? '').toLowerCase();
    return u.includes('kwh') || n.includes('kwh') || n.includes('energy') || n.includes('ae');
}
export function normalizeObjectPeriod(period) {
    const p = String(period ?? '').toLowerCase();
    if (!p)
        return undefined;
    if (['daily', 'weekly', 'monthly', 'yearly'].includes(p))
        return p;
    if (['today', 'this_week', 'this_month', 'last_month', 'this_year', 'last_year', 'custom'].includes(p)) {
        return p;
    }
    return undefined;
}
/** Map widget period (daily/monthly/…) or report default to a concrete date window. */
export function resolveReportDateRange(input) {
    const now = input.now ?? new Date();
    if (input.customFrom && input.customTo) {
        const from = input.customFrom instanceof Date ? input.customFrom : new Date(input.customFrom);
        const to = input.customTo instanceof Date ? input.customTo : new Date(input.customTo);
        if (Number.isFinite(from.getTime()) && Number.isFinite(to.getTime()) && from <= to) {
            return { from, to, label: 'custom' };
        }
    }
    const objectPeriod = normalizeObjectPeriod(input.objectPeriod);
    let rangeKey = objectPeriod
        ?? normalizeObjectPeriod(input.reportDefaultRange)
        ?? String(input.reportDefaultRange ?? 'today').toLowerCase();
    if (rangeKey === 'monthly' || rangeKey === 'this_month' || input.reportType === 'monthly_energy') {
        return {
            from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
            to: now,
            label: 'this_month',
        };
    }
    if (rangeKey === 'last_month') {
        return {
            from: new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0),
            to: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
            label: 'last_month',
        };
    }
    if (rangeKey === 'yearly' || rangeKey === 'this_year') {
        return {
            from: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0),
            to: now,
            label: 'this_year',
        };
    }
    if (rangeKey === 'last_year') {
        return {
            from: new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0),
            to: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0),
            label: 'last_year',
        };
    }
    if (rangeKey === 'weekly' || rangeKey === 'this_week') {
        const day = now.getDay() || 7;
        const start = new Date(now);
        start.setDate(now.getDate() - day + 1);
        start.setHours(0, 0, 0, 0);
        return { from: start, to: now, label: 'this_week' };
    }
    if (rangeKey === 'daily') {
        return {
            from: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
            to: now,
            label: 'today',
        };
    }
    return {
        from: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
        to: now,
        label: 'today',
    };
}
export function tagSummaryFromHistoryRows(tagId, rows, meta) {
    const numeric = rows.filter((r) => typeof r.value === 'number' && Number.isFinite(r.value));
    const values = numeric.map((r) => r.value);
    const first = numeric[0];
    const last = numeric.at(-1);
    const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
    const energy = isEnergyLikeTag(meta?.unit, meta?.tagName);
    const firstValue = first?.value ?? null;
    const lastValue = last?.value ?? null;
    const usageValue = energy && firstValue != null && lastValue != null
        ? Math.max(0, lastValue - firstValue)
        : null;
    return {
        tagId,
        tagName: meta?.tagName,
        unit: meta?.unit ?? null,
        count: numeric.length,
        firstValue,
        lastValue,
        usageValue,
        averageValue: avg,
    };
}
export function enrichTagSummariesWithBilling(summaries, billing) {
    const flatRate = billing?.energyCostRate
        ?? (billing?.totalKwh && billing?.energyCost && billing.totalKwh > 0
            ? billing.energyCost / billing.totalKwh
            : null);
    return summaries.map((tag) => {
        const usage = tag.usageValue ?? (isEnergyLikeTag(tag.unit, tag.tagName) ? null : tag.lastValue);
        const rate = flatRate;
        const amount = usage != null && rate != null ? usage * rate : null;
        return { ...tag, ratePerUnit: rate, amount };
    });
}
function metricValue(tag, metric) {
    if (!tag)
        return null;
    switch (metric) {
        case 'first': return tag.firstValue;
        case 'last': return tag.lastValue;
        case 'usage': return tag.usageValue ?? (isEnergyLikeTag(tag.unit, tag.tagName) ? null : tag.lastValue);
        case 'rate': return tag.ratePerUnit ?? null;
        case 'amount': return tag.amount ?? null;
        default:
            return tag.usageValue ?? tag.lastValue ?? tag.averageValue;
    }
}
function replaceToken(expr, token, value) {
    if (value == null || !Number.isFinite(value))
        return expr;
    return expr.replaceAll(token, String(value));
}
function replaceLetterMetric(expr, letter, metric, tagIds, summaryById) {
    const token = `@${letter}.${metric}`;
    const index = letter.charCodeAt(0) - 65;
    const tagId = tagIds[index];
    const tag = tagId ? summaryById.get(tagId) : undefined;
    return replaceToken(expr, token, metricValue(tag, metric));
}
export function evaluateReportFormulaExpression(formula, tagIds, tagSummaries, billing) {
    const trimmed = formula.trim();
    if (!trimmed)
        return null;
    const summaryById = new Map(tagSummaries.map((t) => [t.tagId, t]));
    let expr = trimmed;
    for (const tag of tagSummaries) {
        for (const metric of ['first', 'last', 'usage', 'rate', 'amount']) {
            expr = replaceToken(expr, `{${tag.tagId}.${metric}}`, metricValue(tag, metric));
        }
        const fallback = metricValue(tag, 'default');
        if (fallback != null) {
            expr = replaceToken(expr, `{${tag.tagId}}`, fallback);
        }
    }
    if (billing) {
        expr = replaceToken(expr, '@totalKwh', billing.totalKwh ?? null);
        expr = replaceToken(expr, '@energyCost', billing.energyCost ?? null);
        expr = replaceToken(expr, '@demandCost', billing.demandCost ?? null);
        expr = replaceToken(expr, '@grandTotal', billing.grandTotal ?? null);
        expr = replaceToken(expr, '@vat', billing.vat ?? null);
        expr = replaceToken(expr, '@peakKw', billing.peakDemandKw ?? null);
        expr = replaceToken(expr, '@rate', billing.energyCostRate
            ?? (billing.totalKwh && billing.energyCost && billing.totalKwh > 0 ? billing.energyCost / billing.totalKwh : null));
    }
    const primaryId = tagIds[0];
    const primary = primaryId ? summaryById.get(primaryId) : tagSummaries[0];
    expr = replaceToken(expr, '@first', metricValue(primary, 'first'));
    expr = replaceToken(expr, '@last', metricValue(primary, 'last'));
    expr = replaceToken(expr, '@usage', metricValue(primary, 'usage'));
    expr = replaceToken(expr, '@amount', metricValue(primary, 'amount'));
    for (const letter of ['A', 'B', 'C', 'D', 'E', 'F']) {
        for (const metric of ['first', 'last', 'usage', 'rate', 'amount']) {
            expr = replaceLetterMetric(expr, letter, metric, tagIds, summaryById);
        }
    }
    tagIds.forEach((id, i) => {
        const letter = String.fromCharCode(65 + i);
        const tag = summaryById.get(id);
        const val = metricValue(tag, 'default');
        if (val != null) {
            expr = expr.replace(new RegExp(`\\b${letter}\\b`, 'g'), String(val));
        }
    });
    if (!FORMULA_SAFE.test(expr))
        return null;
    try {
        const result = Function(`"use strict"; return (${expr})`)();
        return Number.isFinite(result) ? result : null;
    }
    catch {
        return null;
    }
}
export function formatReportFormulaResult(value, decimalPlaces = 2) {
    if (value == null || !Number.isFinite(value))
        return '—';
    const dp = Math.max(0, Math.min(6, decimalPlaces));
    return value.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
export function resolveFieldMetricValue(metric, summary, liveValue) {
    if (metric === 'live') {
        return liveValue != null && Number.isFinite(Number(liveValue)) ? Number(liveValue) : null;
    }
    if (!summary)
        return null;
    if (metric === 'first')
        return summary.firstValue;
    if (metric === 'last')
        return summary.lastValue;
    if (metric === 'usage')
        return metricValue(summary, 'usage');
    return summary.lastValue ?? liveValue ?? null;
}
export function billingToFormulaContext(billing) {
    return {
        totalKwh: Number(billing.totalKwh),
        energyCost: Number(billing.energyCost),
        demandCost: Number(billing.demandCost),
        grandTotal: Number(billing.grandTotal),
        vat: Number(billing.vat),
        peakDemandKw: Number(billing.peakDemandKw),
        energyCostRate: Number(billing.energyCostRate),
        currency: typeof billing.currency === 'string' ? billing.currency : undefined,
    };
}
