import React from 'react';
import type { ReportObjectDefinition, TagSummary } from '@energylink/shared-types';
import {
  billingToFormulaContext,
  enrichTagSummariesWithBilling,
  type ReportBillingFormulaContext,
  type ReportTagPeriodSummary,
} from '@energylink/shared-types';
import { billingApi } from '../../api/billingApi';
import { formatReportFieldDisplay } from './reportFieldDisplay';
import type { ReportPeriodContextInput } from './reportPeriodContext';
import { resolveObjectReportRange } from './reportPeriodContext';
import { resolveReportTagIds } from './reportPatchUtils';
import { loadTagSummaryForRange } from './reportTagSummaryLoader';

function objectHasPeriodOverride(object: ReportObjectDefinition): boolean {
  return Boolean(object.props?.period ?? object.props?.reportPeriod);
}

export function useReportObjectFieldData(
  object: ReportObjectDefinition,
  tags: TagSummary[],
  reportInput: ReportPeriodContextInput,
  fallback: {
    tagSummaries: Map<string, ReportTagPeriodSummary>;
    billing: ReportBillingFormulaContext | null;
    liveValue?: number | null;
  },
): { display: string; loading: boolean } {
  const hasOverride = objectHasPeriodOverride(object);
  const [localSummaries, setLocalSummaries] = React.useState<Map<string, ReportTagPeriodSummary>>(new Map());
  const [localBilling, setLocalBilling] = React.useState<ReportBillingFormulaContext | null>(null);
  const [loading, setLoading] = React.useState(false);

  const range = React.useMemo(
    () => resolveObjectReportRange(object, reportInput),
    [object.props?.period, object.props?.reportPeriod, reportInput.defaultDateRange, reportInput.reportType],
  );

  const tagIds = React.useMemo(() => {
    const ids = new Set<string>(resolveReportTagIds(object));
    for (const id of object.tagIds ?? []) if (id) ids.add(id);
    return Array.from(ids);
  }, [object.id, object.tagId, object.sourceTagId, object.tagIds]);

  const tagKey = tagIds.join(',');

  React.useEffect(() => {
    if (!hasOverride) {
      setLocalSummaries(new Map());
      setLocalBilling(null);
      setLoading(false);
      return;
    }

    if (!tagIds.length && !reportInput.tariffId) {
      setLocalSummaries(new Map());
      setLocalBilling(null);
      return;
    }

    let cancelled = false;
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
        ...tagIds.map(async (tagId) => {
          const tag = tags.find((t) => t.id === tagId);
          return loadTagSummaryForRange(tagId, tag, from, to);
        }),
      ]);

      if (cancelled) return;

      const billingCtx = billingRes.ok
        ? billingToFormulaContext(billingRes.data as ReportBillingFormulaContext & Record<string, unknown>)
        : null;
      const enriched = enrichTagSummariesWithBilling(summaries, billingCtx);
      setLocalBilling(billingCtx);
      setLocalSummaries(new Map(enriched.map((s) => [s.tagId, s])));
      setLoading(false);
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [hasOverride, tagKey, range.from.getTime(), range.to.getTime(), reportInput.tariffId, reportInput.projectId, tags]);

  const tagSummaries = hasOverride ? localSummaries : fallback.tagSummaries;
  const billing = hasOverride ? localBilling : fallback.billing;

  const display = formatReportFieldDisplay(object, {
    tagSummaries,
    billing,
    liveValue: fallback.liveValue,
    tagId: resolveReportTagIds(object)[0],
  });

  return { display, loading: hasOverride && loading };
}
