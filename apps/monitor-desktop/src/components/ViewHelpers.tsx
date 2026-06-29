import React from 'react';
import { RefreshCw, Play, Square, Search } from 'lucide-react';

export type MonitorNavItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
};

export function MonitorNavBar({
  navItems,
  activeView,
  onNavigate,
  isPolling,
  refreshSeconds,
  loading,
  onRefresh,
  onStart,
  onStop,
  onRefreshSeconds,
}: {
  navItems: MonitorNavItem[];
  activeView: string;
  onNavigate: (key: string) => void;
  isPolling?: boolean;
  refreshSeconds: number;
  loading: boolean;
  onRefresh: () => void;
  onStart: () => void;
  onStop: () => void;
  onRefreshSeconds: (seconds: number) => void;
}) {
  return (
    <div className="app-nav-bar dash-animate">
      <nav className="app-nav-tabs" aria-label="Main navigation">
        {navItems.map(item => (
          <button
            key={item.key}
            type="button"
            className={`app-nav-tab${activeView === item.key ? ' active' : ''}`}
            onClick={() => onNavigate(item.key)}
            title={item.label}
            aria-current={activeView === item.key ? 'page' : undefined}
          >
            <span className="app-nav-tab-icon">{item.icon}</span>
            <span className="app-nav-tab-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="app-nav-actions">
        <button
          type="button"
          className="btn-outline toolbar-btn"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh"
          aria-label="Refresh"
        >
          <RefreshCw size={16} strokeWidth={1.75} className={loading ? 'spin-icon' : ''} />
          <span className="toolbar-btn-label">Refresh</span>
        </button>
        {isPolling ? (
          <button
            type="button"
            className="btn-danger toolbar-btn"
            onClick={onStop}
            title="Stop Polling"
            aria-label="Stop Polling"
          >
            <Square size={16} strokeWidth={1.75} />
            <span className="toolbar-btn-label">Stop</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary toolbar-btn"
            onClick={onStart}
            title="Start Polling"
            aria-label="Start Polling"
          >
            <Play size={16} strokeWidth={1.75} />
            <span className="toolbar-btn-label">Start</span>
          </button>
        )}
        <label className="toolbar-label" htmlFor="refresh-interval">
          Auto
        </label>
        <select
          id="refresh-interval"
          className="refresh-select toolbar-select"
          value={refreshSeconds}
          onChange={e => onRefreshSeconds(Number(e.target.value))}
          aria-label="Auto refresh interval"
        >
          <option value={2}>2s</option>
          <option value={5}>5s</option>
          <option value={10}>10s</option>
          <option value={30}>30s</option>
        </select>
        <span
          className={`toolbar-polling-badge${isPolling ? ' on' : ''}`}
          title={isPolling ? 'Live active' : 'Idle'}
        >
          <span className="status-pulse-dot good" />
          <span className="toolbar-polling-text">{isPolling ? 'Live' : 'Idle'}</span>
        </span>
      </div>
    </div>
  );
}

export function ViewPageHeader({
  title,
  subtitle,
  badge,
  actions,
}: {
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const hasHeading = Boolean(title || subtitle);
  const hasToolbar = Boolean(badge || actions);
  if (!hasHeading && !hasToolbar) return null;

  return (
    <div className={`view-page-header dash-animate${!hasHeading ? ' view-page-header--toolbar-only' : ''}`}>
      {hasHeading && (
        <div>
          {title && <h1 className="view-page-title">{title}</h1>}
          {subtitle && <p className="view-page-sub">{subtitle}</p>}
        </div>
      )}
      {hasToolbar && (
        <div className="view-page-header-right">
          {badge}
          {actions}
        </div>
      )}
    </div>
  );
}

export function EmptyPanel({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="empty-state empty-state-light dash-animate">
      <div className="empty-state-icon">{icon}</div>
      <b>{title}</b>
      {description && <p>{description}</p>}
    </div>
  );
}

export function ViewSearchInput({
  value,
  onChange,
  placeholder,
  variant = 'page',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  variant?: 'page' | 'sidebar';
}) {
  return (
    <div className={`view-search-wrap dash-animate dash-animate-delay-1${variant === 'sidebar' ? ' view-search-wrap-sidebar' : ''}`}>
      <Search size={16} strokeWidth={1.75} className="view-search-icon" aria-hidden="true" />
      <input
        type="search"
        className="view-search-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search...'}
      />
    </div>
  );
}
