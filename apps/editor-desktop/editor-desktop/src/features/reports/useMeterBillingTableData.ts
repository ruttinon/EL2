import React from 'react';
import type { DeviceSummary, ReportObjectDefinition, TagSummary } from '@energylink/shared-types';
import {
  billingToFormulaContext,
  buildMeterBillingRows,
  enrichTagSummariesWithBilling,
  listMeterBillingTags,
  resolveReportDateRange,
  type MeterBillingRow,
  type ReportBillingFormulaContext,
} from '@energylink/shared-types';
import { billingApi } from '../../api/billingApi';
import type { ReportPeriodContextInput } from './reportPeriodContext';
import { loadTagSummaryForRange } from './reportTagSummaryLoader';

export function useMeterBillingTableData(
  object: ReportObjectDefinition,
  tags: TagSummary[],
  devices: DeviceSummary[],
  reportInput: ReportPeriodContextInput,
): { rows: MeterBillingRow[]; billing: ReportBillingFormulaContext | null; loading: boolean; rangeLabel: string } {
  const [rows, setRows] = React.useState<MeterBillingRow[]>([]);
  const [billing, setBilling] = React.useState<ReportBillingFormulaContext | null>(null);
  const [loading, setLoading] = React.useState(false);

  const range = React.useMemo(
    () => resolveReportDateRange({
      reportDefaultRange: reportInput.defaultDateRange,
      reportType: reportInput.reportType,
      objectPeriod: object.props?.period ?? object.props?.reportPeriod,
    }),
    [reportInput.defaultDateRange, reportInput.reportType, object.props?.period, object.props?.reportPeriod],
  );

  const tableTags = React.useMemo(
    () => listMeterBillingTags(tags, devices, object.props ?? {}),
    [tags, devices, object.props?.deviceId, object.props?.deviceIds, object.props?.tagIds, object.props?.autoInclude],
  );

  const tagKey = tableTags.map((t) => t.id).join(',');

  React.useEffect(() => {
    let cancelled = false;
    if (!tableTags.length) {
      setRows([]);
      setBilling(null);
      return;
    }

    setLoading(true);
    const from = range.from.toISOString();
    const to = range.to.toISOString();

    void (async () => {
      const [billingRes, ...summaries] = await Promise.all([
        billingApi.getSummary({
          projectId: reportInput.projectId,
          from,
          to,
          tariffId: reportInput.tariffId,
        }),
        ...tableTags.map(async (tag) => {
          const full = tags.find((t) => t.id === tag.id);
          return loadTagSummaryForRange(tag.id, full, from, to);
        }),
      ]);

      if (cancelled) return;

      const billingCtx = billingRes.ok
        ? billingToFormulaContext(billingRes.data as ReportBillingFormulaContext & Record<string, unknown>)
        : null;
      const enriched = enrichTagSummariesWithBilling(summaries, billingCtx);
      const summaryMap = new Map(enriched.map((s) => [s.tagId, s]));
      const built = buildMeterBillingRows(tags, devices, summaryMap, object.props ?? {}, billingCtx);

      setBilling(billingCtx);
      setRows(built);
      setLoading(false);
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [tagKey, range.from.getTime(), range.to.getTime(), reportInput.tariffId, reportInput.projectId, object.id]);

  return { rows, billing, loading, rangeLabel: range.label };
}
