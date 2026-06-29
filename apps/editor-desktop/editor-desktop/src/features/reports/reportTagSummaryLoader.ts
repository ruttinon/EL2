import type { TagSummary } from '@energylink/shared-types';
import { tagSummaryFromHistoryRows } from '@energylink/shared-types';
import { editorRuntimeApi } from '../../api/editorRuntimeApi';

export async function loadTagSummaryForRange(
  tagId: string,
  tag: TagSummary | undefined,
  from: string,
  to: string,
) {
  const res = await editorRuntimeApi.getTrend({
    tagId,
    from,
    to,
    limit: 500,
    points: 200,
    agg: 'last',
  });
  const points = res.ok && res.data.values?.length
    ? res.data.values.map((p) => ({ value: p.value ?? null, readAt: p.readAt }))
    : [];
  if (points.length === 0) {
    const live = await editorRuntimeApi.getCurrentValues();
    const current = live.ok ? live.data.values.find((v) => v.id === tagId) : undefined;
    const v = current?.value != null ? Number(current.value) : null;
    return {
      tagId,
      tagName: tag?.name,
      unit: tag?.unit ?? null,
      count: v != null ? 1 : 0,
      firstValue: v,
      lastValue: v,
      usageValue: null,
      averageValue: v,
    };
  }
  return tagSummaryFromHistoryRows(tagId, points, {
    tagName: tag?.name,
    unit: tag?.unit ?? null,
  });
}
