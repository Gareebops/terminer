import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage } from "@/components/legal-page";
import { formatAmount, ISSUER, PLANS } from "@/lib/invoice";

export const metadata: Metadata = {
  title: "Uslovi korišćenja",
  description:
    "Uslovi korišćenja Terminer platforme za salone: usluga, probni period, cene i naplata.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Uslovi korišćenja" updated="3. jul 2026.">
      <p>
        Terminer je platforma koju vodi{" "}
        <strong>
          {ISSUER.name}, {ISSUER.address}, {ISSUER.city}
        </strong>{" "}
        (PIB {ISSUER.pib}, MB {ISSUER.mb}). Registracijom salona prihvataš ove
        uslove.
      </p>

      <h2>Prava proistekla iz plaćanja članarine</h2>
      <ul>
        <li>mini-sajt salona na adresi terminer.rs/naziv-salona;</li>
        <li>online zakazivanje termina za klijente salona, bez njihove registracije;</li>
        <li>admin panel: kalendar, rezervacije, usluge, tim, smene, galerija i izgled sajta;</li>
        <li>email potvrde termina klijentima koji ostave adresu.</li>
      </ul>

      <h2>Probni period i iznos članarine</h2>
      <p>
        Prvih <strong>30 dana je besplatno</strong>, bez unošenja kartice i bez
        obaveze. Nakon probe, korišćenje se naplaćuje po cenovniku:
      </p>
      <ul>
        <li>
          mesečna članarina - {formatAmount(PLANS.monthly.amount)} RSD;
        </li>
        <li>
          godišnja članarina - {formatAmount(PLANS.yearly.amount)} RSD (dva
          meseca gratis).
        </li>
      </ul>
      <p>
        Plaćanje je fakturom sa NBS IPS QR kodom, prenosom na račun. Faktura se
        izdaje iz admin panela, u sekciji Pretplata.
      </p>

      <h2>Šta se dešava kada članarina istekne</h2>
      <p>
        Po isteku plaćenog perioda salon ima još 7 dana počeka. Nakon toga se
        pauzira samo online zakazivanje - sajt salona ostaje dostupan
        posetiocima, a svi podaci ostaju sačuvani. Uplatom po novoj fakturi sve
        se odmah nastavlja.
      </p>

      <h2>Odgovornost za sadržaj</h2>
      <p>
        Salon je odgovoran za tačnost i zakonitost sadržaja koji objavljuje
        (usluge, cene, fotografije, podaci o timu) i za podatke svojih
        klijenata, kojima rukuje u skladu sa{" "}
        <Link href="/privatnost" className="underline">
          politikom privatnosti
        </Link>
        . Zadržavamo pravo da uklonimo sadržaj koji krši propise ili tuđa
        prava.
      </p>

      <h2>Pristup podrške nalogu</h2>
      <p>
        Radi rešavanja tehničkog problema, podrška može - isključivo uz tvoju
        prethodnu saglasnost - privremeno pristupiti admin panelu tvog salona.
        Svaki takav pristup se beleži i koristi samo za pomoć oko konkretnog
        problema.
      </p>

      <h2>Dostupnost usluge</h2>
      <p>
        Trudimo se da Terminer radi pouzdano i neprekidno, ali ne možemo
        garantovati stopostotnu dostupnost - kratki prekidi zbog održavanja ili
        okolnosti van naše kontrole su mogući. Bitne izmene i planirane radove
        najavljujemo unapred.
      </p>

      <h2>Raskid</h2>
      <p>
        Salon može prestati sa korišćenjem u svakom trenutku - dovoljno je da
        ne produži pretplatu. Na zahtev brišemo nalog i sve podatke salona
        (osim faktura, koje čuvamo u zakonskom roku). Zadržavamo pravo da
        ukinemo nalog koji grubo krši ove uslove, uz prethodno upozorenje.
      </p>

      <h2>Izmene uslova i kontakt</h2>
      <p>
        O bitnim izmenama ovih uslova obaveštavamo vlasnike salona mejlom. Za
        sva pitanja piši na{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </LegalPage>
  );
}
