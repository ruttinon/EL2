import React from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { UiIcon } from './UiIcon';
import type { CarbonSummaryResponse } from '../api/engineApi';

type CarbonConfigBannerProps = {
  carbonSummary?: CarbonSummaryResponse;
};

export function CarbonConfigBanner({ carbonSummary }: CarbonConfigBannerProps) {
  const issues = (carbonSummary?.configIssues ?? []).filter(i => i.severity !== 'info');
  const [expanded, setExpanded] = React.useState(false);

  if (!issues.length) return null;

  const top = issues.find(i => i.severity === 'error') ?? issues[0];
  const more = issues.length - 1;

  return (
    <div
      className={`carbon-config-banner carbon-config-banner--${top.severity}`}
      role="status"
    >
      <UiIcon
        icon={top.severity === 'error' ? AlertTriangle : Info}
        size="sm"
        className="carbon-config-banner-icon"
      />
      <div className="carbon-config-banner-body">
        <strong>Carbon configuration</strong>
        <span>{top.message}</span>
        {more > 0 && !expanded && (
          <button
            type="button"
            className="carbon-config-banner-toggle"
            onClick={() => setExpanded(true)}
          >
            +{more} more issue(s)
            <ChevronDown size={14} />
          </button>
        )}
        {expanded && issues.length > 1 && (
          <ul className="carbon-config-banner-list">
            {issues.slice(1).map(issue => (
              <li key={issue.code} className={`carbon-config-issue--${issue.severity}`}>
                {issue.message}
              </li>
            ))}
          </ul>
        )}
        {expanded && issues.length > 1 && (
          <button
            type="button"
            className="carbon-config-banner-toggle"
            onClick={() => setExpanded(false)}
          >
            Show less
            <ChevronUp size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
