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
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black p-8 text-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
          <div className="max-w-md space-y-2 text-center">
            <h1 className="text-xl font-bold tracking-tight">Something went wrong</h1>
            <p className="text-sm leading-relaxed text-neutral-500">
              {this.state.error?.message || 'An unexpected error occurred. Please refresh the page.'}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-bold transition-all hover:bg-white/10"
            >
              <RefreshCcw className="h-4 w-4" />
              Try again
            </button>
            <button
              onClick={() => {
                window.location.href = '/dashboard';
              }}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold transition-all hover:bg-blue-500"
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
