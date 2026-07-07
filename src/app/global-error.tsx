"use client"; // error boundary mora biti klijentska komponenta

// Zamena za CEO root layout kad pukne i sam layout — mora da vrati sopstveni
// <html>/<body>. Namerno bez globals.css i next/font (i oni mogu biti uzrok
// pada): inline stilovi + sistemski font, boje brenda ukucane.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="sr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#E4E9E0",
          color: "#17181A",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: 16,
        }}
      >
        <title>Greška | Terminer</title>
        <div
          style={{
            maxWidth: 560,
            width: "100%",
            backgroundColor: "#17181A",
            color: "#ffffff",
            borderRadius: 32,
            padding: "56px 32px",
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>
            Nešto je pošlo naopako
          </h1>
          <p
            style={{
              margin: "12px auto 0",
              maxWidth: 400,
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.5,
            }}
          >
            Došlo je do neočekivane greške. Pokušaj ponovo — ako se greška
            ponavlja, javi nam se.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: 28,
              border: "none",
              borderRadius: 999,
              backgroundColor: "#A6F5A6",
              color: "#17181A",
              padding: "14px 28px",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Pokušaj ponovo
          </button>
          {error.digest ? (
            <p
              style={{
                marginTop: 24,
                fontSize: 12,
                color: "rgba(255,255,255,0.35)",
              }}
            >
              Šifra greške: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
