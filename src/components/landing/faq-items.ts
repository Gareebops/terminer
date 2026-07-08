// Pitanja u zasebnom (server-bezbednom) modulu: "use client" fajl ne sme
// da izvozi podatke ka server komponenti (stigla bi client-reference,
// ne niz) - a landing stranici trebaju i za JSON-LD.
export const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "Treba li mi tehničko znanje?",
    a: "Ne. Sve se podešava kliktanjem - uneseš usluge, tim i radno vreme, izabereš boju i fotografije, i sajt je spreman. Ako negde zapneš, tu smo da pomognemo.",
  },
  {
    q: "Koliko brzo mogu da krenem?",
    a: "Za jedno popodne. Registracija traje minut, a vodič te zatim provede kroz usluge, tim i izgled sajta. Većina salona objavi sajt isti dan.",
  },
  {
    q: "Kako klijenti zakazuju?",
    a: "Na tvom sajtu izaberu uslugu, osobu i slobodan termin - bez naloga i bez instaliranja aplikacije. Potvrda im stiže na email, a termin mogu i da otkažu linkom iz mejla. Ti dobijaš obaveštenje o svakoj rezervaciji.",
  },
  {
    q: "Radim sam/sama - da li mi ovo uopšte treba?",
    a: "Baš tada najviše. Klijenti vide tvoje slobodne termine i zakažu sami, pa ne moraš da prekidaš rad usred termina zbog telefona - a propušten poziv više ne znači propuštenog klijenta.",
  },
  {
    q: "Radimo u smenama - može li to da se podesi?",
    a: "Može. Za svakog zaposlenog biraš „isto svake nedelje“ ili smene A/B koje se dalje smenjuju same, a odmor i praznike upisuješ kao izuzetke. Termini se nude samo kad neko stvarno radi.",
  },
  {
    q: "Kako se plaća?",
    a: "Prvih 30 dana je besplatno, bez kartice. Posle biraš: 1.990 RSD mesečno ili 19.900 RSD godišnje. Dobijaš fakturu sa IPS QR kodom - platiš skeniranjem iz m-banking aplikacije ili prenosom sa računa.",
  },
  {
    q: "Mogu li da povežem sopstveni domen?",
    a: "Možeš. Sajt odmah radi na adresi terminer.rs/tvoj-salon, a u podešavanjima u par koraka povezuješ i svoj domen, npr. mojsalon.rs.",
  },
  {
    q: "Šta ako hoću da odustanem?",
    a: "Nema ugovorne obaveze - jednostavno ne produžiš članarinu. Sajt ti ostaje na mreži, pauzira se samo online zakazivanje dok ne produžiš, a podatke o klijentima i terminima ti izvozimo na zahtev.",
  },
];
