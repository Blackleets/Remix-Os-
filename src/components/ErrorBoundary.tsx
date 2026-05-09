import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App error boundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-black text-white flex-col gap-6 p-8">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <div className="text-center space-y-2 max-w-md">
            <h1 className="text-xl font-bold tracking-tight">Something went wrong</h1>
            <p className="text-neutral-500 text-sm leading-relaxed">
              {this.state.error?.message || 'An unexpected error occurred. Please refresh the page.'}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-bold hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              Try again
            </button>
            <button
              onClick={() => { window.location.href = '/dashboard'; }}
              className="px-5 py-2.5 bg-blue-600 rounded-xl text-sm font-bold hover:bg-blue-500 transition-all"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
