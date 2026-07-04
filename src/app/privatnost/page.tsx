import type { Metadata } from "next";
import { CONTACT_EMAIL, LegalPage } from "@/components/legal-page";
import { ISSUER } from "@/lib/invoice";

export const metadata: Metadata = {
  title: "Politika privatnosti",
  description:
    "Kako Terminer prikuplja, koristi i čuva podatke vlasnika salona i njihovih klijenata.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Politika privatnosti" updated="3. jul 2026.">
      <p>
        Terminer je platforma za online zakazivanje za salone koju vodi{" "}
        <strong>
          {ISSUER.name}, {ISSUER.address}, {ISSUER.city}
        </strong>{" "}
        (PIB {ISSUER.pib}, MB {ISSUER.mb}). Ova politika objašnjava koje podatke
        prikupljamo, zašto ih prikupljamo i koja prava imaš u vezi sa njima.
        Podatke obrađujemo u skladu sa Zakonom o zaštiti podataka o ličnosti
        Republike Srbije.
      </p>

      <h2>Podaci vlasnika salona</h2>
      <p>
        Kada registruješ salon na Termineru, prikupljamo podatke potrebne za
        rad naloga i pružanje usluge:
      </p>
      <ul>
        <li>email adresu i lozinku (lozinka se čuva isključivo u zaštićenom, heširanom obliku);</li>
        <li>naziv salona i sadržaj koji sam uneseš (usluge, cene, tim, fotografije, kontakt podaci);</li>
        <li>podatke za izdavanje fakture (naziv pravnog lica, adresa, PIB) - ako ih uneseš;</li>
        <li>izdate fakture, koje po zakonu čuvamo 10 godina.</li>
      </ul>

      <h2>Podaci klijenata salona</h2>
      <p>
        Kada klijent zakaže termin na sajtu salona, unosi ime i prezime, broj
        telefona i, po želji, email adresu. Ove podatke prikuplja salon kod
        koga se termin zakazuje - salon je rukovalac tim podacima, a Terminer
        ih čuva i obrađuje u ime salona, isključivo radi:
      </p>
      <ul>
        <li>evidencije i upravljanja rezervacijama u tom salonu;</li>
        <li>slanja potvrde termina mejlom (ako je email ostavljen), sa linkom za otkazivanje.</li>
      </ul>
      <p>
        Podaci klijenata jednog salona nikada nisu vidljivi drugim salonima ni
        trećim licima i ne koriste se za marketing.
      </p>

      <h2>Gde se podaci čuvaju</h2>
      <p>Za rad platforme koristimo proverene pružaoce usluga:</p>
      <ul>
        <li>
          <strong>Supabase</strong> - baza podataka i prijava, serveri u
          Evropskoj uniji (Frankfurt, Nemačka);
        </li>
        <li>
          <strong>Vercel</strong> - hosting aplikacije;
        </li>
        <li>
          <strong>Resend</strong> - slanje email potvrda termina.
        </li>
      </ul>

      <h2>Koliko dugo čuvamo podatke</h2>
      <p>
        Podaci naloga i sadržaj salona čuvaju se dok salon ima nalog na
        Termineru. Salon u svakom trenutku može da obriše podatke svojih
        klijenata ili zatraži brisanje celog naloga. Fakture čuvamo u zakonskom
        roku od 10 godina.
      </p>

      <h2>Kolačići</h2>
      <p>
        Koristimo samo neophodne kolačiće - one bez kojih prijava na nalog ne
        može da radi. Nemamo marketinške ni analitičke kolačiće trećih strana.
      </p>

      <h2>Tvoja prava</h2>
      <p>
        Imaš pravo na uvid u svoje podatke, njihovu ispravku ili brisanje, kao
        i pravo na prigovor na obradu. Za bilo koje od ovih prava, ili pitanje
        o ovoj politici, piši na{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
          {CONTACT_EMAIL}
        </a>
        . Ako je reč o podacima koje si ostavio pri zakazivanju termina, možeš
        se obratiti i direktno salonu.
      </p>

      <h2>Izmene ove politike</h2>
      <p>
        Ako se politika bitno promeni, obavestićemo vlasnike salona mejlom.
        Datum poslednje izmene uvek stoji na vrhu ove stranice.
      </p>
    </LegalPage>
  );
}
