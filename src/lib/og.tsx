import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Zajednička podešavanja za generisane OG slike (deljenje linka na
// Viber/WhatsApp/društvene mreže). Fontovi su statični TTF u src/assets/fonts
// (satori ne ume next/font) — putanje moraju ostati literale zbog file tracinga.

export const OG_SIZE = { width: 1200, height: 630 };

export async function ogFonts() {
  const [extraBold, medium] = await Promise.all([
    readFile(
      join(process.cwd(), "src/assets/fonts/PlusJakartaSans-ExtraBold.ttf")
    ),
    readFile(
      join(process.cwd(), "src/assets/fonts/PlusJakartaSans-Medium.ttf")
    ),
  ]);
  return [
    { name: "Jakarta", data: extraBold, weight: 800 as const },
    { name: "Jakarta", data: medium, weight: 500 as const },
  ];
}

// Terminer brend kartica: ink pozadina, mint akcenti — koristi je landing
// (i svaka ruta bez svoje slike) i fallback za nepostojeći/neobjavljen salon.
export function TerminerOgCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#17181A",
        padding: 72,
        fontFamily: "Jakarta",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <svg viewBox="0 0 64 64" width={76} height={76}>
          <rect width="64" height="64" rx="14" fill="#A6F5A6" />
          <rect x="15" y="16" width="34" height="10" rx="5" fill="#17181A" />
          <rect x="27" y="16" width="10" height="32" rx="5" fill="#17181A" />
        </svg>
        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: -1,
          }}
        >
          Terminer
        </div>
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 76,
          fontWeight: 800,
          color: "#ffffff",
          letterSpacing: -2,
          lineHeight: 1.08,
          maxWidth: 950,
        }}
      >
        Sajt i online zakazivanje za tvoj salon
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            backgroundColor: "#A6F5A6",
            color: "#17181A",
            fontSize: 30,
            fontWeight: 800,
            padding: "16px 36px",
            borderRadius: 999,
          }}
        >
          terminer.rs
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 500,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          Domaća platforma za salone
        </div>
      </div>
    </div>
  );
}
