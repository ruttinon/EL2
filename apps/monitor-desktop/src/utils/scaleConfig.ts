/** UI thresholds for large deployments (hundreds–thousands of devices). */
export const SCALE = {
  /** Show search hint when device count exceeds this without a filter. */
  DEVICE_SEARCH_HINT: 40,
  /** Default collapse all converter groups in trend picker. */
  AUTO_COLLAPSE_DEVICES: 30,
  /** Max device cards on dashboard grid. */
  DASHBOARD_DEVICE_PREVIEW: 12,
  /** Max root devices in sidebar without search. */
  SIDEBAR_DEVICE_PREVIEW: 40,
  /** Device management page size (converter blocks). */
  DEVICE_PAGE_SIZE: 24,
  /** Virtual list row height (trend tag row). */
  TREND_TAG_ROW_HEIGHT: 40,
  /** Switch trend tag list to virtual scroll above this visible row count. */
  TREND_VIRTUAL_THRESHOLD: 80,
  /** Parallel trend API requests. */
  TREND_FETCH_CONCURRENCY: 6,
  /** Max tags fetched per trend request batch warning. */
  TREND_MAX_TAGS_WARNING: 20,
  /** Alarm table page size. */
  ALARM_PAGE_SIZE: 50,
  /** Raw trend table rows. */
  TREND_RAW_TABLE_ROWS: 200,
  /** Cap stagger animation index for graphics objects. */
  GRAPHICS_ANIM_STAGGER_CAP: 24,
} as const;
