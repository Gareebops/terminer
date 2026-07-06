# Terminer — mobilna aplikacija (iOS + Android)

Admin aplikacija za vlasnike salona: Expo (React Native, SDK 57) + TypeScript.
Ista Supabase baza i nalozi kao web — vlasnik se prijavljuje postojećim
email/lozinkom.

## Pokretanje

```bash
cd mobile
npm install
cp .env.example .env.local   # popuni EXPO_PUBLIC_SUPABASE_URL i ANON_KEY
npx expo start               # QR kod za Expo Go na telefonu
npx expo start --web         # brza provera u browseru
npx tsc --noEmit             # provera tipova
```

## Struktura

- `src/app/` — expo-router ekrani: `prijava.tsx` + `(tabs)/` (Početna,
  Kalendar, Rezervacije, Više). Auth gate je `Stack.Protected` u `_layout.tsx`.
- `src/lib/` — `supabase.ts` (klijent sa AsyncStorage sesijom), `session.tsx`
  (SessionProvider), `data.ts` (upiti pod RLS-om — isti kao web admin),
  `status.ts` (labele statusa preslikane sa weba).
- `src/constants/theme.ts` — Terminer dizajn tokeni (canvas/ink/mint/lavanda,
  Plus Jakarta Sans, radius 32/16/pill). Pravila DS-a važe i ovde.

## Principi

- Čitanja idu direktno na Supabase pod RLS-om člana salona.
- Pisanja sa poslovnom logikom (konflikti, mejlovi) ići će kroz REST rute na
  Next.js (`/api/mobile/*`) — NE duplirati logiku u aplikaciji.
- UI na srpskom; datumi `sr-Latn-RS` (sr-RS daje ćirilicu).
