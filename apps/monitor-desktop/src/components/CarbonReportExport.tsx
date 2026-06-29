import React from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { UiIcon } from './UiIcon';
import { engineApi, type CarbonPeriod } from '../api/engineApi';

type CarbonReportExportProps = {
  period: CarbonPeriod;
  engineUrl: string;
};

export function CarbonReportExport({ period, engineUrl }: CarbonReportExportProps) {
  const [busy, setBusy] = React.useState<'pdf' | 'excel' | null>(null);
  const [message, setMessage] = React.useState<string | undefined>();

  const exportReport = async (format: 'pdf' | 'excel') => {
    setBusy(format);
    setMessage(undefined);
    const result = await engineApi.generateCarbonReport({
      period: period === 'live' ? '30d' : period,
      format,
      requestedBy: 'monitor-dashboard',
    });
    setBusy(null);
    if (!result.ok) {
      setMessage(result.message ?? 'Export failed');
      return;
    }
    const url = `${engineUrl.replace(/\/$/, '')}${result.data.generated.downloadUrl}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setMessage(`Saved ${result.data.generated.fileName}`);
  };

  return (
    <div className="carbon-report-export">
      <span className="carbon-report-export-label">Carbon report</span>
      <div className="carbon-report-export-actions">
        <button
          type="button"
          className="btn-outline toolbar-btn carbon-report-btn"
          disabled={busy !== null}
          onClick={() => void exportReport('pdf')}
        >
          <UiIcon icon={Download} size="sm" />
          {busy === 'pdf' ? 'Exporting…' : 'PDF'}
        </button>
        <button
          type="button"
          className="btn-outline toolbar-btn carbon-report-btn"
          disabled={busy !== null}
          onClick={() => void exportReport('excel')}
        >
          <UiIcon icon={FileSpreadsheet} size="sm" />
          {busy === 'excel' ? 'Exporting…' : 'Excel'}
        </button>
      </div>
      {period === 'live' && (
        <span className="carbon-report-export-hint">Live view exports last 30 days</span>
      )}
      {message && <span className="carbon-report-export-msg">{message}</span>}
    </div>
  );
}
