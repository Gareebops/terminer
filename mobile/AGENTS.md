# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Terminer mobilna aplikacija

Ovo je admin aplikacija za vlasnike salona (iOS + Android). Pre rada pročitaj
[../STANJE_PROJEKTA.md](../STANJE_PROJEKTA.md) — sekcija o mobilnoj aplikaciji
objašnjava arhitekturu i faze. Ključno:

- Ista Supabase baza kao web; čitanja pod RLS-om (upiti preslikani iz web
  admina), pisanja sa poslovnom logikom kroz buduće `/api/mobile/*` rute na
  Next.js — logiku NE duplirati ovde.
- Dizajn tokeni u `src/constants/theme.ts` prate Terminer fintech DS (vidi
  sekciju 5 u STANJE_PROJEKTA.md). UI i poruke na srpskom, datumi sr-Latn-RS.
- Provera: `npx tsc --noEmit`; brza vizuelna verifikacija kroz
  `npx expo start --web` (launch config `terminer-mobile-web`, port 8090).
