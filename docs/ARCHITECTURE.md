# Grčki Giros — arhitektura

Odluke D1–D18 su u `ANALYSIS.md`. Ovaj dokument je ugovor po kome je sistem izgrađen.

## 1. Information architecture

```
grckigiros.rs/
├── /                 početna — apetit, USP, promo, kako radi, izdvojeno, priča, lokacija, posao, finalni CTA
├── /meni/            digitalni meni = mesto poručivanja (traka dostava/preuzimanje, kategorije, filteri, product sheet)
├── /porudzbina/      checkout + potvrda + živi status (noindex)
├── /o-nama/          priča: od 2021, pita iz Atine, kako pravimo giros
├── /dostava/         dostava, preuzimanje, plaćanje, pre-order + FAQ (FAQPage)
├── /kontakt/         lokacija, mapa, radno vreme, telefon, forma
├── /posao/           prodavac-kuvar + prijava (JobPosting)
├── /privatnost/      obaveštenje o obradi podataka
├── /panel/           interno, PIN (noindex, disallow)
└── /404.html
```

Globalno na svakoj stranici: header (logo, navigacija, status otvoreno/zatvoreno, korpa), korpa (drawer), product sheet, mobilna donja traka "Naruči online" koja postaje "Korpa · 3 · 1.850 RSD" kad korpa nije prazna.

## 2. Tok poručivanja

```
bilo koja stranica ──► /meni/
  1. traka: [Dostava | Preuzimanje] + procena vremena + (zona, ako je uključena)
  2. jelo ──► product sheet: meso → pita → sosovi → salate → začini → pomfrit u piti → dodaci → napomena → količina
     jelo bez opcija ("+" na piću) ──► direktno u korpu, toast sa "Poništi"
  3. toast "Dodato" + diskretno "Ide uz ovo" (1 tap)
korpa (drawer) ──► izmena, količina, uklanjanje, "Povoljnije u paketu", međuzbir/dostava/ukupno
/porudzbina/
  1 način · 2 vreme (ŠTO PRE + termini) · 3 ime, telefon, email opc. · 4 adresa (dostava) · 5 gotovina + kusur (dostava) · 6 napomena
  rezime rečenicom: "Dostava na X, oko 15:40, plaćate 1.850 RSD, pripremite 2.000 RSD, kusur 150 RSD"
  [Naruči · 1.850 RSD] ──► server: validacija → broj → upis → email → odgovor
potvrda: karta sa brojem #37, detalji, kopiraj/podeli/štampaj, živi status (Primljena → Prihvaćena → U pripremi → Na putu/Spremna → Završena)
```

Zatvoreno: dugmad za dodavanje postaju "Poručivanje od 09:00", checkout ne prima porudžbinu, header i traka kažu "Trenutno ne radimo · Otvaramo sutra u 09:00". Meni ostaje pregledljiv.

## 3. Dizajn pravac

**Koncept: atinski kiosk u editorijalnom ruhu.** Mediteransko plava polja, sunčano zlatni CTA, toplo belo "papir" okruženje, ogromna kondenzovana tipografija, grčki meandar kao tanka struktura, lučni (santorinski) okviri za slike i **karta sa brojem** kao ključni brend objekat — broj porudžbine 1–100 se ponaša kao broj iz automata za red.

| Token | Vrednost | Upotreba |
|---|---|---|
| `--paper` | #FAF7F0 | pozadina (PDF: bela, fotografski stil: topla) |
| `--surface` | #FFFFFF | sheet, kartice forme |
| `--ink` | #16202E | tekst |
| `--aegean` | #1B4F8C | brend, naslovi, footer (PDF) |
| `--gold` | #F5A623 | primarni CTA sa tamnim tekstom (kontrast 8:1) (PDF) |
| `--tomato` | #D1432B | ljuto, greške |
| `--olive` | #4C7A3A | vege, uspeh |
| `--cream` | #F2EBDD | alternativne sekcije |

Tipografija: **Archivo** variable (wght 100–900, wdth 62–125), jedna porodica za sve — kondenzovani black za naslove, normalna širina za tekst. Latin Extended (č ć š ž đ), self-hosted woff2, `font-display: swap`. Varijabilna širina je i potpis pokreta (naslovi se "rašire" pri reveal-u).

Pokret: 500 ms outQuart kao osnova (JB), 180 ms za mikro, sve kroz `prefers-reduced-motion` prekidač. Nema preloadera, nema custom kursora, nema smooth-scroll biblioteke.

Ilustracije: ručno pravljen SVG u "sticker" stilu (tamna kontura + ravne boje), slojevi za CSS 3D. Slike proizvoda zamenjuju ilustraciju čim se unesu u `PRODUCTS.image`.

## 4. Frontend

```
src/pages/*.html        stranice sa <!--#include--> partialima i {{promenljivama}} iz snapshot-a
src/partials/           head, header, footer, cart, sheet, ikonice (sprite)
src/styles/             tokens → base → layout → components → pages → print
src/scripts/shared/     *.cjs, deljeno sa Apps Script-om (build kopira u backend)
  scheduling.cjs        radno vreme, poslovni dan, ŠTO PRE, termini, "otvaramo …"
  pricing.cjs           cena stavke, korpa, dostava, paket-hint
  validation.cjs        telefon, ime, email, adresa, gotovina, porudžbina
  money.cjs             format RSD, zaokruživanje, predlozi za gotovinu
src/scripts/core/       config, api (timeout, retry, idempotencija), store (korpa, localStorage), catalog, clock (serverNow offset)
src/scripts/ui/         header, cart-drawer, product-sheet, dialog (focus trap), toast, mode-bar, motion, tilt, magnetic, ticket
src/scripts/pages/      home, menu, checkout, panel, contact, jobs
```

Build (`tools/build.mjs`, esbuild): ESM + code splitting (zajednički chunk keširan između stranica), minifikacija, CSS bundle, prerender menija u HTML (radi bez JS-a, SEO), sitemap, generisanje `Seed.gs` i kopija shared modula u `backend/apps-script/`. Nema frameworka.

Budžet: JS < 60 KB gzip ukupno, CSS < 20 KB gzip, font < 60 KB, LCP < 2,5 s na 4G.

## 5. Model podataka (katalog)

```
Category   { id, name, sort, description, active }
Product    { id, categoryId, name, description, price, comparePrice, image, tags[], badge,
             available, delivery, pickup, groups[], defaults[], pairs[], bundleHint, includes, kind, sort, demo }
Group      { id, name, type: single|multi, required, min, max, display: cards|chips|toggle|info, hint, sort }
Option     { id, groupId, name, price, available, sort }
```

- Tagovi: `popular`, `recommended`, `new`, `spicy`, `vegetarian`, `promo`, `family`, `value`. Filter se prikazuje samo ako ga ima bar jedan proizvod.
- "BEZ": podrazumevana opcija (iz `defaults`) koju je gost isključio. Karta za kuhinju prikazuje samo razlike.
- Paketi: `kind=bundle`, sopstvene grupe (npr. meso za prvi i drugi giros), `comparePrice` za uštedu, `bundleHint` (`cat:giros+cat:pice`) za "Povoljnije u paketu".
- "Najčešće se naručuje uz": noćni proračun ko-pojavljivanja iz `ORDER_ITEMS` (`RECS_AUTO`), ručni `pairs` ima prednost.

## 6. Google Sheets

| Sheet | Ko piše | Sadržaj |
|---|---|---|
| `DASHBOARD` | skripta (10 min) | danas / nedelja / mesec / godina / ukupno, top proizvod/kategorija/paket, najprometniji sat/dan, dostava/preuzimanje %, otkazano %, 14 dana + grafikon 30 dana |
| `ORDERS` | skripta, panel | jedna porudžbina = jedan red (35 kolona, vidi `Config.gs`) |
| `ORDER_ITEMS` | skripta | jedna stavka = jedan red (za top proizvode, kategorije, pakete) |
| `CUSTOMERS` | skripta | CRM po telefonu: broj porudžbina, potrošnja, prosek, poslednja, omiljeni proizvod |
| `PRODUCTS` `CATEGORIES` `OPTION_GROUPS` `OPTIONS` | Ognjen / panel | meni, cene, dostupnost |
| `SETTINGS` | vlasnik / panel | ključ-vrednost: kontakt, vremena, termini, dostava, primaoci, test režim |
| `HOURS` `SPECIAL_HOURS` | vlasnik | nedeljno radno vreme; praznici, zatvaranja, izuzeci |
| `ZONES` | vlasnik | zone dostave (naselja, cena, minimum) |
| `DAILY_STATS` `WEEKLY_STATS` `MONTHLY_STATS` `LIFETIME_STATS` | skripta | rollup tabele |
| `REPORT_CONFIG` | vlasnik | dnevni/nedeljni/mesečni izveštaj: uključen, dan, sat, primaoci |
| `CONTACT` `JOBS` | skripta | poruke i prijave |
| `SYSTEM_LOG` `ERROR_LOG` | skripta | vreme, request ID, severity, funkcija, status, poruka, order ID, trajanje, retry |
| `RECS_AUTO` | skripta (noću) | preporuke iz podataka |

Vreme u `HOURS` se čita kao prikazani tekst (`getDisplayValues`), kolone su formatirane kao tekst — izbegava poznatu grešku sa vremenskim ćelijama iz 1899. godine.

## 7. Apps Script

```
Config.gs     imena sheet-ova, šeme kolona, podrazumevana podešavanja
Api.gs        doGet/doPost, ruter, JSON omotač, request ID, merenje vremena
Settings.gs   čitanje SETTINGS/HOURS/SPECIAL_HOURS/ZONES/REPORT_CONFIG (keš 5 min, verzija)
Catalog.gs    katalog, javni meni, dostupnost
Orders.gs     kreiranje porudžbine (pipeline ispod)
Counter.gs    javni broj 1..N i globalna sekvenca, pod ScriptLock-om
Customers.gs  CRM upsert
Email.gs      karta za kuhinju, potvrda kupcu, izveštaji, forme; test režim, kvota, pojedinačna isporuka
Stats.gs      agregacije (čista funkcija nad redovima → testabilno)
Reports.gs    dnevni/nedeljni/mesečni, rollup, dashboard, preporuke, održavanje
Panel.gs      PIN → HMAC token, lista, statusi, rasprodato, pauza, gužva
Forms.gs      kontakt, posao (CV → Drive)
Security.gs   sanitizacija, formula-injection zaštita, rate limit, idempotencija
Log.gs        SYSTEM_LOG / ERROR_LOG
Setup.gs      kreiranje sheet-ova, seed, okidači, meni u Sheets-u, admin akcije
Util.gs       datumi u Europe/Belgrade, poslovni dan, ID-jevi
Shared_*.gs   generisano iz src/scripts/shared (isti kod kao na sajtu)
Seed.gs       generisano iz data/seed.json
```

**Pipeline porudžbine** (`order.create`):
1. parse + veličina zahteva + honeypot + minimalno vreme popunjavanja
2. idempotencija: `requestId` već viđen → vrati isti odgovor (bez nove porudžbine)
3. rate limit: po telefonu (3/10 min) i globalno (20/min)
4. server-side validacija kupca, adrese, gotovine
5. dostupnost po **serverskom** vremenu (isti `scheduling.cjs`): pauza, radno vreme, ŠTO PRE ili termin
6. cene iz `PRODUCTS`/`OPTIONS` (klijentske cene se ignorišu); razlika → `PRICE_CHANGED` + svež katalog
7. `ScriptLock.waitLock(20 s)` → ponovna provera idempotencije → sledeći broj → upis `ORDERS` + `ORDER_ITEMS` → unlock
8. CRM upsert, email kuhinji (svaki primalac posebno, greška jednog ne ruši ostale), email kupcu
9. log + odgovor; greška posle koraka 7 ne poništava porudžbinu (već je sačuvana), loguje se i vraća uspeh

**Brojevi:** `PUBLIC_NO` 1..`order_number_max` (100) posle 100 ide 1; `ORDER_SEQ` globalno raste i nikad se ne vraća. Interni ID: `GG-YYYYMMDD-<broj>-<SEQ hex>` (npr. `GG-20260923-37-00A4`) — jedinstven po konstrukciji, ne po slučajnosti.

**Okidači** (instalira ih "Grčki Giros ▸ Instaliraj automatiku", jednom): dnevni izveštaj 01:00–01:30, nedeljni ponedeljak 02:00, mesečni 1. u mesecu 03:00, dashboard na 10 min, održavanje 04:00 (rollup, preporuke, skraćivanje logova, usklađivanje okidača sa `REPORT_CONFIG`). Apps Script okidači imaju ±15 min tolerancije.

## 8. API ugovor

Jedan Web App URL. GET za čitanje, POST sa `Content-Type: text/plain` (bez CORS preflight-a).

| Akcija | Metod | Ulaz | Izlaz |
|---|---|---|---|
| `bootstrap` | GET | — | `version, serverNow, business, hours, specialHours, zones, catalog, recs` |
| `order.status` | GET | `id, t` | `status, publicNumber, updatedAt` |
| `order.create` | POST | vidi dole | `publicNumber, orderId, statusToken, mode, when, promisedTime, subtotal, deliveryFee, total, cash, change` |
| `contact.submit` | POST | ime, telefon, email, tema, poruka | `ok` |
| `jobs.submit` | POST | ime, telefon, email, iskustvo, smena, poruka, CV (base64 ≤ 4 MB) | `ok` |
| `panel.login` | POST | `pin` | `token` (12 h) |
| `panel.orders` | POST | `token, since` | aktivne porudžbine danas |
| `panel.status` | POST | `token, orderId, status` | ažurirana porudžbina |
| `panel.availability` | POST | `token, productId, available` | — |
| `panel.settings` | POST | `token, orderingEnabled?, extraWaitMin?` | — |

```json
{ "action": "order.create", "payload": {
  "requestId": "uuid", "mode": "delivery", "when": "asap", "businessDate": "2026-09-23",
  "customer": { "name": "…", "phone": "…", "email": "" },
  "address": { "street": "…", "number": "12a", "apt": "", "zone": "", "note": "" },
  "cash": 2000, "note": "",
  "items": [ { "productId": "klasik", "qty": 1, "options": ["meso-pilece", "sos-tzatziki"], "note": "" } ],
  "clientTotal": 1850,
  "meta": { "startedAt": 0, "channel": "instagram", "hp": "" } } }
```

Greške: `{ ok:false, error:{ code, message, field? }, requestId }`, kodovi `VALIDATION, CLOSED, SLOT_UNAVAILABLE, PRICE_CHANGED, ITEM_UNAVAILABLE, RATE_LIMITED, BUSY, SERVER_ERROR, BAD_REQUEST, UNAUTHORIZED`. `message` je uvek rečenica za gosta na srpskom; tehnički detalj ide samo u `ERROR_LOG`.

## 9. Pravila vremena (config-driven)

- Sat: `Europe/Belgrade`, na klijentu korigovan serverskim `serverNow` (pogrešan sat na telefonu ne menja termine).
- Poslovni dan: prozor može da pređe ponoć (09:00 → 01:00). Posle `business_day_rollover_hour` (06) počinje novi dan.
- Prozor po načinu: preuzimanje = radno vreme lokala; dostava = `delivery_open`–`delivery_close`.
- ŠTO PRE: dozvoljeno ako `open ≤ sada ≤ close − asap_cutoff_min`.
- Termini: od `sada + slot_first_offset_min`, zaokruženo naviše na `slot_round_min`, korak `slot_interval_min`, do `min(close, sada + preorder_max_ahead_min)`, nikad pre `open + pickup_eta_min`.
- Prioritet: `ordering_enabled=FALSE` (pauza) > `SPECIAL_HOURS` za datum > `HOURS` za dan u nedelji.
- Server prihvata termin sa tolerancijom od 10 min (klijent ga je izračunao malo ranije).

## 10. Bezbednost

- Nijedna tajna nije u frontendu: PIN (heš + so) i HMAC ključ su u Script Properties.
- Sve cene, vremena i dostupnost se ponovo računaju na serveru.
- Sanitizacija: kontrolni karakteri, dužine, `escapeHtml` u svim emailovima, prefiks `'` za vrednosti koje počinju sa `= + - @` (formula injection u Sheets).
- Honeypot, minimalno vreme popunjavanja, rate limit, idempotencija, ograničenje veličine zahteva.
- Status porudžbine se čita samo sa `id` + nasumičnim `statusToken` (nema pogađanja tuđih porudžbina).
- Ograničenje: Apps Script ne vidi IP ni Origin — origin provera nije moguća, dokumentovano.

## 11. Testiranje

- Unit (`node --test`): scheduling (sva vremena iz tačke 57 prompta + ponoć + nedelja + praznici + pauza), pricing, validation, money.
- Apps Script (`tests/gas`): pravi `.gs` fajlovi u Node VM-u sa emulatorom Google servisa (Sheets, Lock, Cache, Properties, Mail, Utilities, Drive). Brojevi 98→99→100→1→2, jedinstveni ID-jevi, idempotencija, greške Sheets/email servisa, statistike, izveštaji.
- E2E (`tests/e2e`, playwright-core + lokalni Chrome): dev server sa emulatorom kao backendom — dostava, preuzimanje, zatvoreno, greške, dupli klik, promena cene, responsive screenshotovi 375–1920.
- Na pravom Google nalogu: vodič u `SETUP.md` (deploy + test porudžbina + provera emaila).
