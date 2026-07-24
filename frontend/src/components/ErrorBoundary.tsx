import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an uncaught error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2.5rem',
          maxWidth: '650px',
          margin: '4rem auto',
          background: 'rgba(239, 68, 68, 0.08)',
          color: 'var(--danger)',
          borderRadius: '16px',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          boxShadow: 'var(--shadow)',
          fontFamily: 'sans-serif'
        }}>
          <h2 style={{ margin: '0 0 1rem 0', fontFamily: 'Poppins, sans-serif' }}>⚠️ Application Error</h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text)' }}>
            The application crashed during rendering. This is often caused by missing configuration, uninitialized third-party APIs (like Clerk), or maps loading issues.
          </p>
          <div style={{
            background: 'rgba(0, 0, 0, 0.1)',
            padding: '1rem',
            borderRadius: '10px',
            marginTop: '1.25rem',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            overflowX: 'auto',
            maxHeight: '200px'
          }}>
            {this.state.error?.stack || this.state.error?.toString()}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1.5rem',
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(107, 47, 160, 0.2)'
            }}
          >
            Reload Application
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
