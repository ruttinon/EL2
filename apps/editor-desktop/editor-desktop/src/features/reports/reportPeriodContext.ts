import React from 'react';
import type { ReportObjectDefinition, TagSummary } from '@energylink/shared-types';
import {
  billingToFormulaContext,
  enrichTagSummariesWithBilling,
  listMeterBillingTags,
  resolveReportDateRange,
  type ReportBillingFormulaContext,
  type ReportTagPeriodSummary,
} from '@energylink/shared-types';
import { billingApi } from '../../api/billingApi';
import { resolveReportTagIds } from './reportPatchUtils';
import { loadTagSummaryForRange } from './reportTagSummaryLoader';

export type ReportPeriodContextInput = {
  defaultDateRange?: string | null;
  reportType?: string | null;
  tariffId?: string;
  projectId?: string;
};

export type ReportPeriodContext = {
  range: ReturnType<typeof resolveReportDateRange>;
  billing: ReportBillingFormulaContext | null;
  tagSummaries: Map<string, ReportTagPeriodSummary>;
  loading: boolean;
  refresh: () => void;
};

function collectTagIdsFromObjects(
  objects: ReportObjectDefinition[],
  tags: TagSummary[] = [],
  devices: Array<{ id: string; name: string }> = [],
): string[] {
  const ids = new Set<string>();
  for (const object of objects) {
    for (const id of resolveReportTagIds(object)) ids.add(id);
    for (const id of object.tagIds ?? []) if (id) ids.add(id);
    if (object.type === 'meter_billing_table' || object.type === 'energy_summary' || object.type === 'cost_summary') {
      for (const tag of listMeterBillingTags(tags, devices, object.props ?? {})) {
        ids.add(tag.id);
      }
    }
  }
  return Array.from(ids);
}

export function useReportPeriodContext(
  objects: ReportObjectDefinition[],
  tags: TagSummary[],
  devices: Array<{ id: string; name: string }>,
  input: ReportPeriodContextInput,
): ReportPeriodContext {
  const [billing, setBilling] = React.useState<ReportBillingFormulaContext | null>(null);
  const [tagSummaries, setTagSummaries] = React.useState<Map<string, ReportTagPeriodSummary>>(new Map());
  const [loading, setLoading] = React.useState(false);
  const [tick, setTick] = React.useState(0);

  const range = React.useMemo(
    () => resolveReportDateRange({
      reportDefaultRange: input.defaultDateRange,
      reportType: input.reportType,
    }),
    [input.defaultDateRange, input.reportType],
  );

  const tagIdsKey = React.useMemo(
    () => collectTagIdsFromObjects(objects, tags, devices).sort().join(','),
    [objects, tags, devices],
  );

  React.useEffect(() => {
    let cancelled = false;
    const tagIds = tagIdsKey ? tagIdsKey.split(',').filter(Boolean) : [];
    if (!tagIds.length && !input.tariffId) {
      setTagSummaries(new Map());
      setBilling(null);
      return;
    }

    setLoading(true);
    void (async () => {
      const from = range.from.toISOString();
      const to = range.to.toISOString();

      const [billingRes, ...tagResults] = await Promise.all([
        billingApi.getSummary({
          projectId: input.projectId,
          from,
          to,
          tariffId: input.tariffId,
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

      const summaries = enrichTagSummariesWithBilling(tagResults, billingCtx);
      setBilling(billingCtx);
      setTagSummaries(new Map(summaries.map((s) => [s.tagId, s])));
      setLoading(false);
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [tagIdsKey, range.from.getTime(), range.to.getTime(), input.tariffId, input.projectId, tags, tick]);

  const refresh = React.useCallback(() => setTick((t) => t + 1), []);

  return { range, billing, tagSummaries, loading, refresh };
}

/** Resolve date range for a single object (object period overrides report default). */
export function resolveObjectReportRange(
  object: ReportObjectDefinition,
  reportInput: ReportPeriodContextInput,
) {
  return resolveReportDateRange({
    reportDefaultRange: reportInput.defaultDateRange,
    reportType: reportInput.reportType,
    objectPeriod: object.props?.period ?? object.props?.reportPeriod,
  });
}
