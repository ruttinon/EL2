import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', background: '#fdf2f2', border: '1px solid #f8b4b4', borderRadius: '8px', color: '#9b1c1c', margin: '20px', fontFamily: 'monospace', fontSize: '14px', lineHeight: '1.5' }}>
          <h2 style={{ marginTop: 0, fontSize: '18px' }}>Something went wrong (EnergyLink Editor Crash)</h2>
          <p style={{ fontWeight: 'bold' }}>{this.state.error?.toString()}</p>
          <pre style={{ background: '#fff', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '4px', overflow: 'auto', maxHeight: '300px', fontSize: '12px' }}>
            {this.state.error?.stack}
          </pre>
          <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => {
                window.location.reload();
              }}
              style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 0, borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Reload Page
            </button>
            <button 
              onClick={() => {
                if (confirm('Are you sure you want to clear localStorage? This will reset local database settings to defaults.')) {
                  window.localStorage.clear();
                  window.location.reload();
                }
              }}
              style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 0, borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Clear Cache & Reset Settings
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
