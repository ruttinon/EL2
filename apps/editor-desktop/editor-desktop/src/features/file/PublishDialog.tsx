import { useEffect, useRef, useState } from 'react';
import { publishProject, type PublishResult } from '../../api/publishApi';

type Stage = 'syncing' | 'publishing' | 'done' | 'error';

type Props = {
  projectId:   string;
  projectName: string;
  onClose:     () => void;
  onPublished: (result: PublishResult) => void;
};

/**
 * Export to Monitor dialog
 * ─────────────────────────
 * Styled like PowerStudio SCADA "Synchronizing..." but with a
 * grid-globe + two progress arcs instead of rectangular bars:
 *
 *   outer ring (teal)  = "Synchronizing..."             reads draft config
 *   inner ring (grey)  = "Synchronizing application..."  writes snapshot
 *
 * Visual animation runs in parallel with the real API call so the UI
 * can never finish before the server is actually done.
 */
export function PublishDialog({ projectId, projectName, onClose, onPublished }: Props) {
  const [stage,    setStage]    = useState<Stage>('syncing');
  const [outerPct, setOuterPct] = useState(0);
  const [innerPct, setInnerPct] = useState(0);
  const [error,    setError]    = useState<string | null>(null);
  const [result,   setResult]   = useState<PublishResult | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    let timer: number;
    let outer = 0;
    let inner = 0;
    let publishStarted = false;
    let apiResult: PublishResult | null = null;

    /* Fire the real publish call immediately in the background */
    const apiPromise = publishProject(projectId).then((r) => { apiResult = r; });

    function tick() {
      if (cancelled.current) return;

      /* Phase 1 – outer ring fills to 100 % */
      if (outer < 100) {
        outer = Math.min(100, outer + 2);
        setOuterPct(outer);

      /* Phase 2 – inner ring starts */
      } else if (!publishStarted) {
        publishStarted = true;
        setStage('publishing');

      /* Phase 3 – inner ring fills; waits for API if needed */
      } else if (inner < 100) {
        const apiDone  = apiResult !== null;
        const target   = apiDone ? 100 : 90; /* hold at 90 until server responds */
        inner = Math.min(target, inner + 2);
        setInnerPct(inner);
      }

      /* Both rings at 100 % – resolve */
      if (outer >= 100 && inner >= 100) {
        void apiPromise.then(() => {
          if (cancelled.current) return;
          if (!apiResult || !apiResult.ok) {
            setError(apiResult?.message ?? 'Export failed.');
            setStage('error');
          } else {
            setResult(apiResult);
            setStage('done');
            onPublished(apiResult);
          }
        });
        return;
      }

      timer = window.setTimeout(tick, 40);
    }

    timer = window.setTimeout(tick, 40);
    return () => {
      cancelled.current = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const outerC = 2 * Math.PI * 102; /* circumference for r=102 */
  const innerC = 2 * Math.PI * 88;  /* circumference for r=88  */
  const busy   = stage === 'syncing' || stage === 'publishing';

  return (
    <div className="pub-overlay">
      <div className="pub-dialog">

        {/* Header */}
        <div className="pub-title">Export to Monitor</div>
        <div className="pub-subtitle">{projectName}</div>

        {/* Globe */}
        <div className="pub-globe-wrap">
          <svg viewBox="0 0 240 240" width="240" height="240">
            <defs>
              <radialGradient id="pubGlow" cx="35%" cy="28%" r="70%">
                <stop offset="0%"   stopColor="#087c8b" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#087c8b" stopOpacity="0"   />
              </radialGradient>
              <linearGradient id="pubRingOuter" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#3fc4d2" />
                <stop offset="100%" stopColor="#034f5a" />
              </linearGradient>
            </defs>

            {/* Glow fill */}
            <circle cx="120" cy="120" r="80" fill="url(#pubGlow)" />

            {/* Grid globe (rotates slowly) */}
            <g className="pub-globe-grid" stroke="#c9dbe2" strokeWidth="0.8" fill="none">
              <circle cx="120" cy="120" r="80" />
              <ellipse cx="120" cy="120" rx="80" ry="27" />
              <ellipse cx="120" cy="120" rx="80" ry="54" />
              <ellipse cx="120" cy="120" rx="27" ry="80" />
              <ellipse cx="120" cy="120" rx="54" ry="80" />
              <line x1="40"  y1="120" x2="200" y2="120" />
              <line x1="120" y1="40"  x2="120" y2="200" />
            </g>

            {/* Outer progress ring (Synchronizing) */}
            <g transform="rotate(-90 120 120)">
              <circle cx="120" cy="120" r="102" fill="none" stroke="#e2edf1" strokeWidth="5" />
              <circle
                cx="120" cy="120" r="102" fill="none"
                stroke="url(#pubRingOuter)" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={outerC}
                strokeDashoffset={outerC * (1 - outerPct / 100)}
                style={{ transition: 'stroke-dashoffset 0.04s linear', filter: 'drop-shadow(0 0 5px rgba(8,124,139,0.5))' }}
              />
            </g>

            {/* Inner progress ring (Synchronizing application) */}
            <g transform="rotate(-90 120 120)">
              <circle cx="120" cy="120" r="88" fill="none" stroke="#e2edf1" strokeWidth="4" />
              <circle
                cx="120" cy="120" r="88" fill="none"
                stroke="#9bb4bc" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={innerC}
                strokeDashoffset={innerC * (1 - innerPct / 100)}
                style={{ transition: 'stroke-dashoffset 0.04s linear' }}
              />
            </g>

            {/* Labels inside globe */}
            <text x="120" y="105" textAnchor="middle" className="pub-pct-big">{outerPct}%</text>
            <text x="120" y="122" textAnchor="middle" className="pub-ring-label">Synchronizing...</text>
            <text x="120" y="143" textAnchor="middle" className="pub-pct-small">{innerPct}%</text>
            <text x="120" y="158" textAnchor="middle" className="pub-ring-label">Synchronizing application...</text>
          </svg>
        </div>

        {/* Status line */}
        <div className="pub-status">
          {stage === 'syncing'    && 'Collecting project configuration…'}
          {stage === 'publishing' && 'Writing snapshot to Engine…'}
          {stage === 'done'       && `Version ${result?.snapshot?.version ?? '?'} published — Monitor is ready.`}
          {stage === 'error'      && <span className="pub-error">{error}</span>}
        </div>

        {/* Count pills on success */}
        {stage === 'done' && result?.counts && (
          <div className="pub-counts">
            <span>{result.counts.devices}  devices</span>
            <span>{result.counts.tags}     tags</span>
            <span>{result.counts.graphics} graphics</span>
            <span>{result.counts.reports}  reports</span>
          </div>
        )}

        {/* Action */}
        <div className="pub-actions">
          <button className="pm-btn pm-btn--primary" onClick={onClose} disabled={busy}>
            {busy ? 'Please wait…' : stage === 'error' ? 'Close' : 'Done'}
          </button>
        </div>

      </div>
    </div>
  );
}
