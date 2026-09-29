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
├── /admin/           admin panel lokala, PIN (noindex, disallow, no-store)
├── /panel/           staro mesto → preusmerava na /admin/
└── /404.html
```

Globalno na svakoj stranici: header (logo, navigacija, status otvoreno/zatvoreno, korpa), korpa (drawer), product sheet, mobilna donja traka "Naruči online" koja postaje "Korpa · 3 · 1.850 RSD" kad korpa nije prazna.

## 2. Tok poručivanja

```
bilo koja stranica ──► /meni/
  1. traka: [Dostava | Preuzimanje] + procena (min–max) + naselje (zona) + „zakažite do 7 dana“
  2. jelo ──► product sheet: meso → pita → sosovi → salate → začini → pomfrit u piti → dodaci → napomena → količina
     količina > 1 ──► kartice „Komad 1, Komad 2…“: svaki komad svoje opcije i napomena; nov komad kreće od
     podrazumevanih opcija (ne kopira prethodni); „Isto za sve komade“ kopira na zahtev
     jelo bez opcija ("+" na piću) ──► direktno u korpu
  3. toast "Dodato" + diskretno "Ide uz ovo" (1 tap)
korpa (drawer) ──► naselje, izmena, količina, uklanjanje, minimum, "Povoljnije u paketu", međuzbir/dostava/ukupno
/porudzbina/
  1 način · 2 vreme (ŠTO PRE ili ZAKAŽI: dan + termin na 30 min) · 3 ime, telefon, email opc.
  4 naselje, ulica, broj, stan, sprat, napomena za dostavljača (dostava) · 5 gotovina + kusur (dostava) · 6 napomena
  rezime rečenicom: "Dostava na X, stan 4, 2. sprat · sutra u 12:00 · plaćate 1.850 RSD, pripremite 2.000 RSD, kusur 150 RSD"
  [Pošalji porudžbinu · 1.850 RSD] ──► server: validacija → broj → upis → email → odgovor
potvrda: karta #1042 „čeka potvrdu“, detalji, kopiraj/podeli/štampaj, link za status,
         živi status ● Primljena ○ Potvrđena ○ U pripremi ○ Spremna ○ Završena (ili Odbijena), posle završetka ocena
```

Zatvoreno, pauza, pauza u radnom vremenu, ugašena dostava ili preuzimanje: meni ostaje pregledljiv, dugmad za dodavanje su onemogućena, header, traka i checkout kažu "Trenutno ne primamo porudžbine" sa razlogom i vremenom ponovnog otvaranja.

## 3. Dizajn pravac

**Koncept: atinski kiosk u editorijalnom ruhu.** Mediteransko plava polja, sunčano zlatni CTA, toplo belo "papir" okruženje, ogromna kondenzovana tipografija, grčki meandar kao tanka struktura, lučni (santorinski) okviri za slike i **karta sa brojem** kao ključni brend objekat — broj porudžbine (#1042) se ponaša kao broj iz automata za red.

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
src/scripts/pages/      home, menu, checkout, admin, contact, jobs
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
| `DASHBOARD` | skripta (10 min) | danas / nedelja / mesec / godina / ukupno, top proizvod/kategorija/paket, najprometniji sat/dan, dostava/preuzimanje %, odbijeno %, 14 dana + grafikon 30 dana |
| `ORDERS` | skripta, admin | jedna porudžbina = jedan red: broj, kupac, telefon, email, adresa, stan, sprat, zona, napomene, stavke (tekst + JSON snimak), međuzbir, dostava, ukupno, gotovina, kusur, ŠTO PRE ili zakazani datum/vreme, `Accept By`, status i vreme svakog statusa (`Confirmed/Preparing/Ready/Completed/Rejected At`) |
| `ORDER_ITEMS` | skripta | jedna stavka = jedan red: proizvod (snimak naziva), količina, osnovna cena, cena dodataka, jedinična cena, iznos, opcije (tekst + ID-jevi), „BEZ“, napomena |
| `CUSTOMERS` | skripta | CRM po telefonu: broj porudžbina, potrošnja, prosek, poslednja, omiljeni proizvod, odbijene |
| `PRODUCTS` `CATEGORIES` `OPTION_GROUPS` `OPTIONS` | admin panel | meni, cene, slike, dodaci, dostupnost, redosled |
| `SETTINGS` | admin panel / vlasnik | ključ-vrednost: kontakt, procene, rok za prihvatanje, termini, dostava, primaoci, prekidači, test režim |
| `HOURS` `SPECIAL_HOURS` | admin panel / vlasnik | nedeljno radno vreme sa pauzom (`break_start`, `break_end`); praznici i izuzeci |
| `ZONES` | admin panel | zone dostave (naselja, cena, minimum, aktivna) |
| `FEEDBACK` | skripta | ocena 1–5, dobro, može bolje, komentar, po porudžbini (jedna ocena po porudžbini) |
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
Counter.gs    javni broj od order_number_start (#1001…) i globalna sekvenca, pod ScriptLock-om; reset samo nad praznim ORDERS
Customers.gs  CRM upsert
Email.gs      karta za kuhinju (rok 5 min, link na /admin/), kupcu: primljena / potvrđena / odbijena / spremna; izveštaji, forme
Stats.gs      agregacije (čista funkcija nad redovima → testabilno)
Reports.gs    dnevni/nedeljni/mesečni, rollup, dashboard, preporuke, održavanje
Admin.gs      PIN → HMAC token; tabla porudžbina, prelazi statusa, istorija, dashboard; CRUD menija, dodataka,
              kategorija, zona, radnog vremena i podešavanja; upload fotografija na Drive; feedback; promena PIN-a
Feedback.gs   ocena kupca (samo sa tokenom porudžbine, samo ZAVRŠENA, jednom)
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
10. ponovljen zahtev čiji je prvi odgovor izgubljen (keš istekao) dobija tu istu porudžbinu iz tabele, a ne „zatvoreno“, „rate limit“ ili „cena promenjena“

**Izgubljen odgovor** (slab signal, osvežena stranica usred slanja): browser pamti `requestId` poslatog pokušaja (samo heš sadržaja, bez ličnih podataka) dok ne dobije odgovor. Pre bilo kog novog slanja, ili odmah pri otvaranju checkout-a, pita `order.lookup` da li je taj pokušaj već postao porudžbina. Ako jeste, prikazuje je umesto da šalje drugu.

**Brojevi:** `PUBLIC_NO` kreće od `order_number_start` (1001) i samo raste (#1001, #1002…); `ORDER_SEQ` globalno raste i nikad se ne vraća. Interni ID: `GG-YYYYMMDD-<broj>-<SEQ hex>` (npr. `GG-20260923-1042-00A4`) — jedinstven po konstrukciji, ne po slučajnosti. Ako upis u ORDERS ne uspe, brojač se vraća (nema rupa).

**Statusi** (šifre u tabeli, nazivi za ljude):

```
NEW (NOVA) ──► CONFIRMED (POTVRĐENA) ──► PREPARING (U PRIPREMI) ──► READY (SPREMNA) ──► COMPLETED (ZAVRŠENA)
   └──────────────► REJECTED (ODBIJENA) ◄── iz bilo kog otvorenog statusa (otkazivanje telefonom)
```

- Dozvoljeni prelazi su u `STATUS_TRANSITIONS` (`Config.gs`): napred jedan ili više koraka, jedan korak nazad između POTVRĐENA…ZAVRŠENA (greška pri dodiru), ODBIJENA je konačna. Server odbija sve ostalo.
- **Rok od 5 minuta**: `Accept By = vreme prijema + accept_timeout_min`. „Kasni“ se računa pri čitanju (tabla, status kupca), bez okidača. Porudžbina se nikad sama ne potvrđuje.
- Emailovi kupcu (samo ako je ostavio email i `customer_status_emails` = TRUE): NOVA→POTVRĐENA, →ODBIJENA, prvi put SPREMNA kod preuzimanja (vraćanje koraka ne šalje ništa). Šalju se posle otpuštanja lock-a.
- **Dva uređaja**: panel šalje i status koji je video (`from`). Ako ga je drugi uređaj u međuvremenu promenio, server odbija sa `CONFLICT` i porukom šta se desilo; isti cilj sa dva uređaja (oba „Prihvati“) je bezopasan.
- Dugmad u panelu se crtaju samo iz `next` koji server vraća uz svaku porudžbinu (ista `STATUS_TRANSITIONS` pravila).

**Okidači** (instalira ih "Grčki Giros ▸ Instaliraj automatiku", jednom): dnevni izveštaj 01:00–01:30, nedeljni ponedeljak 02:00, mesečni 1. u mesecu 03:00, dashboard na 10 min, održavanje 04:00 (rollup, preporuke, skraćivanje logova, usklađivanje okidača sa `REPORT_CONFIG`). Apps Script okidači imaju ±15 min tolerancije.

## 8. API ugovor

Jedan Web App URL. GET za čitanje, POST sa `Content-Type: text/plain` (bez CORS preflight-a).

| Akcija | Metod | Ulaz | Izlaz |
|---|---|---|---|
| `bootstrap` | GET | — | `version, serverNow, business, hours, specialHours, zones (sa stvarnim minimumom), catalog, recs` |
| `order.status` | GET | `id, t` | `status, publicNumber, mode, when, whenText, acceptBy, overdue, feedbackAllowed, …` |
| `order.lookup` | POST | `requestId` | `found` + ista porudžbina kao iz `order.create`; nikad ne pravi novu |
| `order.create` | POST | vidi dole | `publicNumber, orderId, statusToken, status, acceptBy, mode, when, whenText, scheduledDate/Time, promisedTime, etaMin/Max, subtotal, deliveryFee, total, cash, change` |
| `feedback.submit` | POST | `id, t, rating, good[], improve[], comment` | `saved` |
| `contact.submit` | POST | ime, telefon, email, tema, poruka | `ok` |
| `jobs.submit` | POST | ime, telefon, email, iskustvo, smena, poruka, CV (base64 ≤ 4 MB) | `ok` |
| `admin.login` | POST | `pin` | `token` (12 h, klizno: svaki admin odgovor posle pola roka vraća nov `session.token`) |
| `admin.board` | POST | `token` | sve otvorene + današnje porudžbine, dashboard, prekidači, stanje lokala |
| `admin.status` | POST | `token, orderId, status, from` | ažurirana porudžbina (+ email kupcu); `CONFLICT` ako `from` više nije tačan |
| `admin.order` / `admin.history` | POST | `orderId` / `q, date, status, page` | detalj / pretraga (30 po strani) |
| `admin.catalog` | POST | `token` | sve kategorije, grupe, opcije, proizvodi (i sakriveni) |
| `admin.product.save / .move / .flag` | POST | proizvod / `id, dir` / `id, field (available/active), value` | katalog |
| `admin.category.save / .move` | POST | kategorija / `id, dir` | katalog |
| `admin.group.save`, `admin.option.save / .move` | POST | grupa / opcija / `id, dir` | katalog |
| `admin.image.upload` | POST | `type, data (base64 ≤ 2 MB), name` | `url` javne slike na Drive-u |
| `admin.zones`, `admin.zone.save / .move` | POST | — / zona / `id, dir` | zone |
| `admin.hours`, `admin.hours.save` | POST | — / 7 dana | radno vreme |
| `admin.settings`, `admin.settings.save` | POST | — / `changes` (samo dozvoljeni ključevi, svaki sa validatorom) | podešavanja |
| `admin.feedback` | POST | `page` | prosek, raspodela, lista |
| `admin.pin.change` | POST | `currentPin, newPin` | nov `token`; svi ostali uređaji su odjavljeni |

```json
{ "action": "order.create", "payload": {
  "requestId": "uuid", "mode": "delivery", "when": "2026-09-24 12:00",
  "customer": { "name": "…", "phone": "…", "email": "" },
  "address": { "street": "…", "number": "12a", "apt": "4", "floor": "2", "zone": "ns-grad", "note": "" },
  "cash": 2000, "note": "",
  "items": [ { "productId": "klasik", "qty": 1, "options": ["meso-pilece", "sos-tzatziki"], "note": "" },
             { "productId": "klasik", "qty": 1, "options": ["meso-pilece", "sos-tzatziki", "dod-meso"], "note": "" } ],
  "clientTotal": 1850,
  "meta": { "elapsedMs": 45000, "channel": "instagram", "hp": "" } } }
```

`when` je `"asap"` ili termin `"YYYY-MM-DD HH:MM"` (kalendarski datum; termin posle ponoći pripada prethodnom poslovnom danu).

Greške: `{ ok:false, error:{ code, message, field? }, requestId }`, kodovi `VALIDATION, CLOSED, SLOT_UNAVAILABLE, MIN_ORDER, ZONE_UNAVAILABLE, PRICE_CHANGED, ITEM_UNAVAILABLE, RATE_LIMITED, BUSY, CONFLICT, SERVER_ERROR, BAD_REQUEST, UNAUTHORIZED`. `message` je uvek rečenica za kupca/lokal na srpskom; tehnički detalj ide samo u `ERROR_LOG`.

## 9. Pravila vremena (config-driven)

- Sat: `Europe/Belgrade`, na klijentu korigovan serverskim `serverNow` (pogrešan sat na telefonu ne menja termine).
- Poslovni dan: prozor može da pređe ponoć (09:00 → 01:00). Posle `business_day_rollover_hour` (06) počinje novi dan.
- Prozor po načinu: preuzimanje = radno vreme lokala; dostava = `delivery_open`–`delivery_close`; pauza (`break_start`–`break_end`) iseca oba.
- Poručivanje (i ŠTO PRE i zakazivanje) je moguće samo dok lokal radi: `open ≤ sada < close − asap_cutoff_min`, van pauze (`break_start − asap_cutoff_min` … `break_end`), uz uključen `ordering_enabled` i način (`delivery_enabled` / `pickup_enabled`).
- Procena: dostava `delivery_eta_min`–`delivery_eta_max`, preuzimanje `pickup_eta_min`–`pickup_eta_max`, obe + `extra_wait_min` (gužva).
- Termini: na svakih `slot_interval_min` (30), poravnati na `slot_round_min` (30), do `preorder_days × 24 h` od sada (7 dana), nikad u prošlosti, nikad pre `sada + max(slot_first_offset_min, najduža procena)`, nikad pre ponovnog početka rada kuhinje + najkraća procena (otvaranje ili kraj pauze), nikad posle `close − asap_cutoff_min`, nikad u pauzi ni u neradni dan.
- Prioritet: `ordering_enabled=FALSE` (pauza) > `SPECIAL_HOURS` za datum > `HOURS` za dan u nedelji.
- Server prihvata termin sa tolerancijom od 10 min (klijent ga je izračunao malo ranije).

## 10. Bezbednost

- Nijedna tajna nije u frontendu: PIN (heš + so) i HMAC ključ su u Script Properties.
- Sve cene, vremena i dostupnost se ponovo računaju na serveru.
- Sanitizacija: kontrolni karakteri, dužine, `escapeHtml` u svim emailovima, prefiks `'` za vrednosti koje počinju sa `= + - @` (formula injection u Sheets).
- Honeypot, minimalno vreme popunjavanja, rate limit, idempotencija, ograničenje veličine zahteva.
- Status porudžbine se čita samo sa `id` + nasumičnim `statusToken` (nema pogađanja tuđih porudžbina).
- Admin token je HMAC potpisan zajedno sa solju PIN-a: promena PIN-a poništava sve ranije izdate tokene (izgubljen telefon). Pogrešan PIN i na prijavi i u „Promeni PIN“ ulazi u isti brojač (8 pokušaja / 10 min).
- Nazivi akcija, proizvoda, opcija i zona se traže samo kao sopstveni ključevi (`hasOwnProperty` / mape bez prototipa): `constructor`, `__proto__`, `toString` nisu ni akcija ni proizvod.
- Polja pogrešnog tipa (objekat umesto teksta, lista umesto broja) se odbijaju ili prazne, nikad se ne upisuju kao „[object Object]“.
- Ograničenje: Apps Script ne vidi IP ni Origin — origin provera nije moguća, dokumentovano.

## 11. Testiranje

- Unit (`node --test`): scheduling (7 dana, termini na 30 min, pauza, ponoć, nedelja, praznici, tolerancija servera), pricing, validation, SEO.
- Apps Script (`tests/gas`): pravi `.gs` fajlovi u Node VM-u sa emulatorom Google servisa (Sheets, Lock, Cache, Properties, Mail, Utilities, Drive). Brojevi #1001…#1250 bez duplikata, idempotencija, statusi i prelazi, rok od 5 min, emailovi kupcu, istorija, CRUD menija/zona/radnog vremena/podešavanja, upload slike, feedback, istorijska tačnost cena, greške Sheets/email servisa, statistike, izveštaji.
- E2E (`tests/e2e`, playwright-core + lokalni Chrome): kupac (komadi različito složeni, zona i minimum, ŠTO PRE i zakazivanje, pauza, zatvoreno, greške, dupli klik, stale korpa), admin (alarm, rok, prihvatanje/odbijanje, statusi, istorija, meni, fotografija, zone, radno vreme, prekidači, procene, feedback), responsive i pristupačnost sajta i svih 13 sekcija admina, performanse.
- Na pravom Google nalogu: vodič u `SETUP.md` (deploy + test porudžbina + provera emaila).

## 12. Odluke za online poručivanje (specifikacija v2)

| # | Odluka | Zašto |
|---|---|---|
| S1 | Statusi NOVA → POTVRĐENA → U PRIPREMI → SPREMNA → ZAVRŠENA + ODBIJENA; nema „na putu“ ni „otkazano“ | tražena lista; otkazivanje ide telefonom i beleži se kao ODBIJENA |
| S2 | Rok od 5 min se računa pri čitanju, bez okidača | Apps Script okidač ne može češće od 1 min i ima ±15 min tolerancije; čitanje je tačno u sekundu |
| S3 | Van radnog vremena i u pauzi nema ni zakazivanja | tražena poruka „Trenutno ne primamo porudžbine“; porudžbinu primljenu dok je lokal zatvoren niko ne bi prihvatio u roku |
| S4 | „7 dana unapred“ = najviše 7 × 24 h od sada | doslovno čitanje; menja se u `preorder_days` |
| S5 | Svaki komad može svoje opcije; isti komadi se spajaju u jednu stavku | tražen primer (Cheeseburger ×2); kuhinja vidi razliku po stavci |
| S6 | Grupe dodataka su zajedničke za više proizvoda (OPTION_GROUPS + OPTIONS), proizvod bira grupe | jedna izmena (npr. nova vrsta sosa) važi za sve girose; spec dozvoljava bolju organizaciju |
| S7 | Zona se bira sa spiska naselja; „nije na spisku“ blokira dostavu; minimum po zoni, prazno = 500 RSD | tražene zone i minimum; bez geokodiranja i plaćenih servisa |
| S8 | Kupac ne unosi ništa osim imena i telefona; email je opcion (za emailove o statusu) | „ne tražiti nepotrebne podatke“ + „kupac dobija obaveštenja“ |
| S9 | Fotografije menija idu na Google Drive lokala (javni link) | bez koda i bez plaćenog hostinga slika |
| S10 | Brojevi #1001+ bez ponavljanja (ranije 1–100 u krug) | tražen stabilan broj (#1042) |
| S11 | Admin menja samo dozvoljene ključeve podešavanja, svaki sa validatorom; `test_mode`, `timezone`, primaoci izveštaja ostaju u tabeli | lokal ne može slučajno da isključi test režim ili pokvari vreme |
| S12 | Ništa se ne briše iz admina (proizvod, kategorija, zona, opcija se isključuju) | istorija porudžbina i statistika ostaju tačne |
