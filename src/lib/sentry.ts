import * as Sentry from '@sentry/react';

// Frontend error/perf observability. Strict no-op until VITE_SENTRY_DSN is
// set, so local dev and the current production deploy are unchanged. Set the
// DSN in the hosting env to turn it on; nothing else needs to change.
let initialized = false;

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn || initialized) return;
  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      // Conservative sampling — bump later from the dashboard if needed.
      tracesSampleRate: 0.1,
      // Don't capture PII by default; this is a multi-tenant B2B app.
      sendDefaultPii: false,
    });
    initialized = true;
  } catch (err) {
    console.error('[Sentry] init failed (continuing without it):', err);
  }
}

// Safe to call unconditionally — a no-op when Sentry was never initialized.
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!initialized) return;
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    /* never let telemetry throw into the app */
  }
}
