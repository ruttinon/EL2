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
    { token: '@avg', label: 'Average reading (primary tag)' },
    { token: '@min', label: 'Min reading (primary tag)' },
    { token: '@max', label: 'Max reading (primary tag)' },
    { token: '@peak', label: 'Peak reading (primary tag)' },
    { token: '@count', label: 'Count of readings (primary tag)' },
    { token: '@sum', label: 'Sum of readings (primary tag)' },
    { token: '@A.first', label: 'Tag A — first' },
    { token: '@A.last', label: 'Tag A — last' },
    { token: '@A.usage', label: 'Tag A — usage' },
    { token: '@A.avg', label: 'Tag A — average' },
    { token: '@A.min', label: 'Tag A — min' },
    { token: '@A.max', label: 'Tag A — max' },
    { token: '@A.peak', label: 'Tag A — peak' },
    { token: '@A.sum', label: 'Tag A — sum' },
    { token: '@A.count', label: 'Tag A — count' },
    { token: '@B.first', label: 'Tag B — first' },
    { token: '@B.last', label: 'Tag B — last' },
    { token: '@B.usage', label: 'Tag B — usage' },
    { token: '@B.avg', label: 'Tag B — average' },
    { token: '@B.min', label: 'Tag B — min' },
    { token: '@B.max', label: 'Tag B — max' },
    { token: '@B.peak', label: 'Tag B — peak' },
    { token: '@B.sum', label: 'Tag B — sum' },
    { token: '@B.count', label: 'Tag B — count' },
];
const FORMULA_SAFE = /^[\d\s.+\-*/()eE]+$/;
export function isEnergyLikeTag(unit, tagName) {
    const u = String(unit ?? '').toLowerCase();
    const n = String(tagName ?? '').toLowerCase();
    return u.includes('kwh') || n.includes('kwh') || n.includes('energy') || n.includes('ae');
}
export function normalizeObjectPeriod(period) {
    const p = String(period ?? '').toLowerCase().trim();
    if (!p)
        return undefined;
    if (p === 'thismonth' || p === 'this_month' || p === 'month' || p === 'monthly')
        return 'this_month';
    if (p === 'lastmonth' || p === 'last_month')
        return 'last_month';
    if (p === 'thisweek' || p === 'this_week' || p === 'week' || p === 'weekly')
        return 'this_week';
    if (p === 'lastweek' || p === 'last_week')
        return 'last_week';
    if (p === 'today' || p === 'daily')
        return 'today';
    if (p === 'yesterday')
        return 'yesterday';
    if (p === '24h' || p === 'last_24h')
        return 'last_24h';
    if (p === '7d' || p === 'last_7d')
        return 'last_7d';
    if (p === '30d' || p === 'last_30d')
        return 'last_30d';
    if (p === 'thisyear' || p === 'this_year' || p === 'yearly')
        return 'this_year';
    if (p === 'lastyear' || p === 'last_year')
        return 'last_year';
    if (p === 'custom')
        return 'custom';
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
        ?? String(input.reportDefaultRange ?? 'today').toLowerCase().trim();
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
    if (rangeKey === 'yesterday') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        return { from: start, to: end, label: 'yesterday' };
    }
    if (rangeKey === 'last_24h') {
        const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        return { from: start, to: now, label: 'last_24h' };
    }
    if (rangeKey === 'last_7d') {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { from: start, to: now, label: 'last_7d' };
    }
    if (rangeKey === 'last_30d') {
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { from: start, to: now, label: 'last_30d' };
    }
    if (rangeKey === 'last_week') {
        const day = now.getDay() || 7;
        const start = new Date(now);
        start.setDate(now.getDate() - day - 6);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { from: start, to: end, label: 'last_week' };
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
    const min = values.length ? Math.min(...values) : null;
    const max = values.length ? Math.max(...values) : null;
    const sum = values.length ? values.reduce((s, v) => s + v, 0) : null;
    return {
        tagId,
        tagName: meta?.tagName,
        unit: meta?.unit ?? null,
        count: numeric.length,
        firstValue,
        lastValue,
        usageValue,
        averageValue: avg,
        minValue: min,
        maxValue: max,
        peakValue: max,
        sumValue: sum,
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
        case 'avg':
        case 'average': return tag.averageValue ?? null;
        case 'min': return tag.minValue ?? null;
        case 'max':
        case 'peak': return tag.peakValue ?? tag.maxValue ?? null;
        case 'sum': return tag.sumValue ?? null;
        case 'count': return tag.count ?? null;
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
    const metricsList = ['first', 'last', 'usage', 'rate', 'amount', 'avg', 'average', 'min', 'max', 'peak', 'sum', 'count'];
    for (const tag of tagSummaries) {
        for (const metric of metricsList) {
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
    expr = replaceToken(expr, '@avg', metricValue(primary, 'avg'));
    expr = replaceToken(expr, '@min', metricValue(primary, 'min'));
    expr = replaceToken(expr, '@max', metricValue(primary, 'max'));
    expr = replaceToken(expr, '@peak', metricValue(primary, 'peak'));
    expr = replaceToken(expr, '@sum', metricValue(primary, 'sum'));
    expr = replaceToken(expr, '@count', metricValue(primary, 'count'));
    for (const letter of ['A', 'B', 'C', 'D', 'E', 'F']) {
        for (const metric of metricsList) {
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
    if (metric === 'avg' || metric === 'average')
        return summary.averageValue ?? null;
    if (metric === 'min')
        return summary.minValue ?? null;
    if (metric === 'max' || metric === 'peak')
        return summary.peakValue ?? summary.maxValue ?? null;
    if (metric === 'sum')
        return summary.sumValue ?? null;
    if (metric === 'count')
        return summary.count ?? null;
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
