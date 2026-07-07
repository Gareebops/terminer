import * as Sentry from "@sentry/nextjs";

// Client-side error monitoring (Sentry) — hvata JS greške u browseru
// (hidratacija, wizard na egzotičnim telefonima...). Bez DSN-a u env je no-op.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // Samo greške — bez tracinga i session replaya (kvota + privatnost)
    tracesSampleRate: 0,
  });
}

// Breadcrumb navigacije uz svaku grešku — Sentry zna na kojoj ruti se desila
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
