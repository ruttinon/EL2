import type { ReportObjectDefinition } from '@energylink/shared-types';
import {
  evaluateReportFormulaExpression,
  formatReportFormulaResult,
  resolveFieldMetricValue,
  type ReportBillingFormulaContext,
  type ReportFieldMetric,
  type ReportTagPeriodSummary,
} from '@energylink/shared-types';

export function reportFieldMetricForObject(object: ReportObjectDefinition): ReportFieldMetric {
  const raw = String(object.props?.metric ?? object.props?.fieldMetric ?? object.props?.valueMode ?? 'last');
  if (raw === 'live' || raw === 'first' || raw === 'usage') return raw;
  return 'last';
}

export function formatReportFieldDisplay(
  object: ReportObjectDefinition,
  options: {
    tagSummaries: Map<string, ReportTagPeriodSummary>;
    billing: ReportBillingFormulaContext | null;
    liveValue?: number | null;
    tagId?: string;
  },
): string {
  const dp = typeof object.style?.decimalPlaces === 'number'
    ? object.style.decimalPlaces
    : (typeof object.props?.decimal === 'number' ? object.props.decimal : 2);
  const unit = String(object.style?.unit ?? object.props?.unit ?? '').trim();

  if (object.type === 'formulavalue' || object.type === 'formula') {
    const formula = String(object.formula ?? object.style?.formula ?? '').trim();
    const tagIds = object.tagIds?.length
      ? object.tagIds
      : (object.tagId ? [object.tagId] : []);
    const summaries = tagIds
      .map((id) => options.tagSummaries.get(id))
      .filter((s): s is ReportTagPeriodSummary => Boolean(s));
    const result = evaluateReportFormulaExpression(formula, tagIds, summaries, options.billing);
    const text = formatReportFormulaResult(result, dp);
    return unit && text !== '—' ? `${text} ${unit}` : text;
  }

  const tagId = options.tagId ?? object.tagId ?? object.sourceTagId;
  const summary = tagId ? options.tagSummaries.get(tagId) : undefined;
  const metric = reportFieldMetricForObject(object);
  const value = resolveFieldMetricValue(metric, summary, options.liveValue);
  const text = formatReportFormulaResult(value, dp);
  return unit && text !== '—' ? `${text} ${unit}` : text;
}
