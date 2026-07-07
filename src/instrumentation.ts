import * as Sentry from "@sentry/nextjs";

// Server-side error monitoring (Sentry). Bez NEXT_PUBLIC_SENTRY_DSN u env
// sve je isključeno — capture pozivi su no-op, app radi identično.
// Source mape se ne uploaduju (nema withSentryConfig) — server stack je
// ionako čitljiv, a build ostaje netaknut.
export function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // Samo greške — tracing bi trošio kvotu besplatnog plana
    tracesSampleRate: 0,
  });
}

// Next zove za svaku server grešku (render, server akcije, route handleri)
export const onRequestError = Sentry.captureRequestError;
