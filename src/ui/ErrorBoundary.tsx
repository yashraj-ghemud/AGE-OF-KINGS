import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Age of Kings crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8" style={{ background: '#07060a', color: '#f1e3c4' }}>
        <div className="gold-text" style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.2em' }}>THE ECLIPSE DEEPENS</div>
        <p style={{ marginTop: 12, opacity: 0.7, maxWidth: 520 }}>Something broke in the realm: {this.state.error.message}</p>
        <button className="btn-ember mt-8 px-8 py-3 rounded-sm" onClick={() => location.reload()}>Rekindle</button>
      </div>
    );
  }
}
