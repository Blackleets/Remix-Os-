import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  // 'fullscreen' (default) is the app-root shell crash screen.
  // 'inline' keeps the sidebar/topbar alive and only replaces the page body,
  // so one broken route never tears down the whole session.
  variant?: 'fullscreen' | 'inline';
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
      if (this.props.variant === 'inline') {
        return (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 rounded-[28px] border border-white/10 bg-[rgba(10,12,18,0.6)] p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
              <AlertTriangle className="h-7 w-7 text-red-400" />
            </div>
            <div className="max-w-md space-y-2">
              <h2 className="text-lg font-bold tracking-tight text-white">Esta sección tuvo un problema</h2>
              <p className="text-sm leading-relaxed text-neutral-500">
                {this.state.error?.message || 'Ocurrió un error inesperado en este módulo. El resto de la app sigue activa.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/[0.08]"
            >
              <RefreshCcw className="h-4 w-4" />
              Reintentar
            </button>
          </div>
        );
      }

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
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-bold transition-all hover:bg-white/10"
            >
              <RefreshCcw className="h-4 w-4" />
              Try again
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/dashboard'; }}
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
