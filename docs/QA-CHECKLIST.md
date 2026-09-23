# QA matrica — Grčki Giros

Stanje: 23.09.2026. Dokazi: `npm test` (153 testa: 81 unit + 72 Apps Script u emulatoru), `npm run test:e2e` (15 tokova u pravom Chrome-u, izveštaj i screenshotovi u `tests/e2e/artifacts/`).

**Važno ograničenje:** backend je testiran tako što se **pravi `.gs` kod** izvršava u lokalnom emulatoru Google servisa (Sheets, LockService, CacheService, Properties, MailApp, Drive, okidači). Na pravom Google nalogu **nije** pokrenut — za to treba `clasp login` ili ručni deploy (docs/SETUP.md, ~45 min). Stavke koje zavise od pravog Google-a označene su **NIJE TESTIRANO**.

## PDF zahtevi → implementirano

| Zahtev (PDF) | Status | Napomena |
|---|---|---|
| Naziv GRČKI GIROS, domen grckigiros.rs | ✅ | domen kupuje vlasnik |
| 2 lokala | ⛔ namerno ne | D1: prompt traži jedan lokal; `location_id` spreman za drugi |
| Email, Instagram | ✅ | Instagram ispravljen na `friends_and_foodns` (PDF je izgubio `_`) |
| Custom sajt sa sopstvenom korpom, ne Webflow | ✅ | |
| Radno vreme 09–01, nedelja ne radi, vidljivo | ✅ | footer, početna, kontakt, dostava; E2E tok 4 |
| Dostava preko agencije ~60 min, 10–00 | ✅ | |
| Zone dostave (agencija određuje) | 🟡 arhitektura + demo | `ZONES` + `zones_enabled`; čeka podatke agencije (N11/N12) |
| Pre-order max 2 h, isti dan | ✅ | `preorder_max_ahead_min=120`; unit testovi |
| Preuzimanje 15 min (do 30), prikazana procena | ✅ | |
| Plaćanje gotovinom (kurir, lokal), bez kartice | ✅ | kartica = budućnost |
| Sastavljanje: meso obavezno, pita, sosovi/salate/začini bez doplate i limita | ✅ | E2E tok 1 i 2 |
| Extra meso uz doplatu | ✅ | cena DEMO 300 (N13) |
| „Bez sastojka“ | ✅ | kuhinja vidi „BEZ: …“ crvenim |
| Napomena gosta | ✅ | po jelu i za celu porudžbinu |
| Kompletan meni, kategorije, cene | 🟡 demo | 27 demo proizvoda (N1–N3), zamena kroz Sheets bez koda |
| Jela koja se ne šalju u dostavu | ✅ | kolona `delivery` |
| Panel lokala: tablet, zvuk, potvrda pre pripreme, rasprodato | ✅ | E2E tok 6 |
| Cene menja Ognjen kroz Google Sheets | ✅ | E2E tok 5d (promena cene tokom korpe) |
| Prijava za posao: 2 emaila, CV neobavezan, auto-potvrda, anti-spam | ✅ | GAS testovi + E2E tok 7 |
| Plata (raspon) | 🟡 | prikazuje se kad se upiše `job_salary` (N9) |
| Promo Giros + sok | ✅ | cena DEMO 720 (N10) |
| Sitemap: /, /meni, /giros, /o-nama, /lokacije, /dostava, /faq, /posao, /kontakt, /panel | ✅ uz spajanje | /giros → product sheet (D6), /lokacije + /kontakt → /kontakt, /faq → /dostava (D14) |
| Početna: hero, promo, kako radi, izdvojeno, o nama, lokacija, posao, finalni CTA | ✅ | |
| Zona/dostava pre sastavljanja (ključni UX fix) | ✅ | traka Dostava/Preuzimanje je prva stvar na meniju |
| Paleta, tipografija, bez tamne pozadine za hranu, ne kao apartmani | ✅ | |
| Copy predlozi (hero, o nama, posao) | ✅ | |
| SEO ključne reči, meta naslovi, schema Restaurant/FoodEstablishment/Menu/FAQPage/JobPosting | ✅ | `tests/unit/seo.test.mjs` |
| „Naruči odmah“ se menja u „Otvaramo u 09:00“ kad je zatvoreno | ✅ | E2E tok 4 |
| Mobile: horizontalne kategorije, korak-po-korak, sticky korpa sa ukupnim | ✅ | |
| Fotografije jela | 🟡 | slotovi spremni, ilustracije do dolaska fotografija (N7) |
| Sajt radi bez JS za osnovni prikaz | ✅ | meni prerenderovan; seo test |
| LCP < 2,5 s na mobilnom | ✅ | 688 / 808 ms (tok 9) |
| GA4 događaji (porudžbina, klik na telefon) | 🟡 NIJE TESTIRANO | kod postoji, aktivira se unosom GA4 ID-a + saglasnost |
| Email potvrda kupcu | ✅ | kad gost unese email; GAS test |

## Prompt zahtevi → implementirano

| # | Zahtev | Status |
|---|---|---|
| 0–2 | Analiza PDF-a, gyros.rs, Joseph Berry (svih 6 stranica) | ✅ docs/ANALYSIS.md |
| 3–5 | Custom HTML/CSS/JS, Sheets + Apps Script, jedan lokal, bez plaćenih servisa | ✅ |
| 6 | Više email primalaca iz SETTINGS, ne iz koda | ✅ svaki primalac posebno; jedan loš ne blokira ostale |
| 7–8 | Pravi kodirani meni, filteri sa svrhom | ✅ filter se prikazuje samo ako ima proizvoda |
| 9 | Product sheet sa dodacima; bez dodataka = 1 dodir | ✅ |
| 10 | Ide uz ovo, najčešće se naručuje uz, popularno, povoljnije u paketu | ✅ (najčešće uz = noćni proračun iz podataka) |
| 11 | Paketi (combo, duo, porodični, promo) sa uštedom | ✅ |
| 12 | Korpa: izmena, uklanjanje (sa „Vrati“), količina, međuzbir/dostava/ukupno, pickup = 0 | ✅ |
| 13–14, 18 | Dostava i preuzimanje sa svim poljima | ✅ |
| 15 | „Sa koliko novca plaćate?“ + predlozi + drugi iznos + kusur + validacija ≥ ukupno | ✅ za dostavu; za preuzimanje se plaća na kasi (D11) |
| 16–17 | Termini u realnom vremenu, ŠTO PRE, +1 h, intervali, bez nemogućih termina, zatvoreno → kada otvaramo | ✅ |
| 19 | Javni broj 1–100 pa 1, jedinstven interni ID, zaštita od race condition | ✅ u emulatoru; pravi paralelni zahtevi NIJE TESTIRANO |
| 20–21 | Operativna karta u emailu | ✅ |
| 22–24 | Strukturisan Sheets (22 lista), ORDERS kolone, statusi, CRM bez naloga | ✅ |
| 25 | Apps Script orkestracija (lock, validacija, logovi, izveštaji, konfiguracija) | ✅ |
| 26, 30, 51–52 | Prihod danas/nedelja/mesec/godina/ukupno, dashboard, sve metrike | ✅ |
| 27–29 | Dnevni 01:00, nedeljni, mesečni izveštaj | ✅ logika; okidači na pravom Google-u NIJE TESTIRANO |
| 31 | Radno vreme iz Sheets-a, praznici, pauza, izuzeci | ✅ |
| 32 | Zone/minimum/besplatna dostava — arhitektura | ✅ |
| 33, 63 | Mobile first, 375–1920 px | ✅ tok 8 (63 kombinacije, 0 problema) |
| 34–36 | Premium dizajn, pokret sa svrhom, 3D bez cirkusa (CSS 3D), reduced motion | ✅ |
| 37–40 | Hero, copy, struktura, lokacija | ✅ |
| 41 | Kontakt forma → Sheets + email | ✅ |
| 42 | Konfiguracija bez koda | ✅ |
| 43–45 | Validacija, greške sa ljudskom porukom, bezbednost | ✅ |
| 46–48 | Performanse, SEO, pristupačnost | ✅ (vidi dole) |
| 49–50 | Potvrda: broj, lokal, način, vreme, ukupno, plaćanje, kopiraj/sačuvaj/štampaj | ✅ + živi status |
| 53–54 | Automatski okidači, SYSTEM_LOG sa request ID, severity, retry | ✅ |
| 55–57 | Demo podaci, test brojeva i vremena | ✅ |

## Funkcionalnost → testirano

| Oblast | Status | Dokaz |
|---|---|---|
| Navigacija, hero, meni, filteri, product sheet | TESTIRANO | E2E 1, 2, 4, 8b |
| Preporuke, paket-hint | TESTIRANO (unit) | pricing.test.mjs |
| Korpa (velika korpa, skrol, dugme dostupno) | TESTIRANO | E2E 1, 2b |
| Checkout dostava / preuzimanje | TESTIRANO | E2E 1, 2 |
| Telefon, adresa, napomena, gotovina, kusur | TESTIRANO | E2E 1, 3; validation.test.mjs |
| Termini i radno vreme (08:30, 09:00, 10:00, 11, 12, 14:23, 20:30, 21, 21:30, 21:59, 22, 23:30, 23:44/45, 00:30, 01:00, 01:05, nedelja, praznik, pauza, gužva) | TESTIRANO | scheduling.test.mjs (+ prompt primer 10–22), E2E 4 |
| Brojevi 98→99→100→1→2, 250 porudžbina bez duplog ID-ja | TESTIRANO (emulator) | orders.test.mjs |
| Lock: broj se menja samo pod lock-om; timeout → BUSY bez potrošenog broja | TESTIRANO (emulator) | orders.test.mjs |
| Idempotencija, dupli klik, ponovni pokušaj posle pada mreže | TESTIRANO | orders.test.mjs, E2E 5b, 5c |
| Pad Sheets-a, pad emaila, jedan loš primalac, kvota, neočekivana greška, loš zahtev | TESTIRANO (emulator) | orders.test.mjs, E2E 5a, 5e |
| Promena cene i rasprodato tokom korpe | TESTIRANO | E2E 5d, 5e |
| Test režim emailova | TESTIRANO (emulator) | orders.test.mjs |
| Panel: PIN, zaključavanje posle 8 pokušaja, statusi, CRM kod otkazivanja, rasprodato, pauza, gužva | TESTIRANO | panel.test.mjs, E2E 6 |
| Status porudžbine za gosta (link iz emaila) | TESTIRANO | E2E 6 |
| Dnevni/nedeljni/mesečni izveštaj, rollup, dashboard, lifetime, održavanje, okidači | TESTIRANO (emulator) | reports.test.mjs |
| Kontakt i posao (CV u Drive) | TESTIRANO | forms.test.mjs, E2E 7 |
| Pravi Google Sheets / MailApp / okidači / Drive | **NIJE TESTIRANO** | zahteva deploy na nalogu lokala |
| Stvarni paralelni zahtevi na LockService | **NIJE TESTIRANO** | Google-ov LockService je dokumentovani mehanizam; kod proverava `hasLock()` |
| Prikaz emaila u Gmail/Outlook aplikacijama | **NIJE TESTIRANO** | HTML je tabelaran sa inline stilovima; proveren samo u pregledaču |
| iOS Safari na pravom uređaju | **NIJE TESTIRANO** | samo Chromium emulacija telefona |

## Responsive, SEO, pristupačnost, performanse, bezbednost

| Oblast | Status | Dokaz |
|---|---|---|
| 375, 390, 430, 768, 1024, 1440, 1920 px | TESTIRANO | 9 stranica × 7 širina: 0 horizontalnog overflow-a |
| SEO: naslovi, opisi, 1× H1, canonical, OG, JSON-LD, sitemap, robots | TESTIRANO | seo.test.mjs |
| Pristupačnost: lang, main, alt, imena dugmadi, labele polja, skip link, focus trap, Escape, vraćanje fokusa, reduced motion | TESTIRANO | E2E 8, 8b (automatski audit, nije ručni WCAG audit sa čitačem ekrana) |
| Performanse (prod build, telefon, Fast 4G, CPU 4×) | TESTIRANO | `/`: LCP 688 ms, CLS 0 · `/meni/`: LCP 808 ms, CLS 0,029 · JS 44 KB gz ukupno, CSS 14 KB gz, font 54 KB |
| Bezbednost: serverska validacija svega, cene/vreme/dostupnost na serveru, escape u emailovima, zaštita od formula u Sheets-u, honeypot, vreme popunjavanja, rate limit, PIN heš + HMAC token, status samo sa tokenom | TESTIRANO | orders/panel/validation testovi |
| Origin provera | ⛔ nije moguća | Apps Script ne izlaže Origin ni IP (docs/SETUP.md) |

## Bagovi pronađeni i ispravljeni tokom testiranja

1. Radio-inputi su prekrivali svoje labele (klik na labelu presretao nevidljiv input).
2. Reduced motion: globalna tranzicija od 1 ms odlagala je `visibility`, fokus nije ulazio u dijalog.
3. Fioke (korpa, panel): grid red `auto` + `flex: 1` bez `min-height: 0` — sa mnogo stavki dugme „Nastavi“ je bežalo ispod ekrana.
4. Provera „prebrzo popunjeno“ koristila je sat telefona (pogrešan sat → gost odbijen kao bot); sada meri trajanje u pregledaču, prag 1,2 s.
5. Neuspešan upis u ORDERS trošio je broj porudžbine; sada se broj vraća i sekvenca nema rupa.
6. Maska animacije naslova sekla je kvačice na Č/Ć/Š/Ž.
7. Status „poručivanje do …“ poredio je vreme kao tekst (00:45 < 23:45).
8. Poruke „rasprodat“ nisu bile u rodu sa nazivom (Fanta) — sada neutralno „Trenutno nema: …“.
9. „Top proizvod“ po količini bi uvek bio sok; sada po prihodu, sa količinom u izveštaju.
