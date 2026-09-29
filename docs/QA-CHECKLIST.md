# QA matrica — Grčki Giros, online poručivanje

Stanje: 29.09.2026. Dokazi:

- `npm test`: **228 testova** (76 unit + 152 Apps Script u emulatoru, od toga 48 napadačkih u `tests/gas/audit.test.mjs`)
- `npm run test:e2e`: **26 tokova** u pravom Chrome-u (uz proveru konzole i svakog neuspelog mrežnog zahteva), izveštaj i screenshotovi u `tests/e2e/artifacts/`

**Važno ograničenje:** backend je testiran tako što se **pravi `.gs` kod** izvršava u lokalnom emulatoru Google servisa (Sheets, LockService, CacheService, Properties, MailApp, Drive, okidači). Na pravom Google nalogu **nije** pokrenut. Za to treba deploy na nalogu lokala (docs/SETUP.md, ~45 min). Sve što zavisi od pravog Google-a je u sekciji „Nije testirano“.

Oznake: **U** = unit (`tests/unit`), **G** = Apps Script u emulatoru (`tests/gas`), **E** = E2E tok u Chrome-u (`tests/e2e/run.mjs`).

## Kupac

| Stavka | Status | Dokaz |
|---|---|---|
| Otvara sajt, otvara online poručivanje | ✅ | E 1 (početna → „Naruči“ → meni) |
| Pregleda kategorije i proizvode | ✅ | E 1, 2, 9 (sve kategorije prerenderovane i žive) |
| Otvara proizvod | ✅ | E 1, 2, 9c (tastatura) |
| Menja količinu | ✅ | E 1 (1 → 2 komada) |
| Dodaje opcije, **svaki komad posebno** | ✅ | E 1 (komad 1 bez luka, komad 2 + extra meso = 2 stavke), G `per-piece options` |
| Dodaje u korpu, menja korpu, briše iz korpe | ✅ | E 1, 2b |
| Bira dostavu / pickup | ✅ | E 1, 2 |
| Unosi ime, telefon, adresu (ulica, broj, stan, sprat, napomena) | ✅ | E 1, 3b; G `ORDERS row carries every field` |
| Bira zonu | ✅ | E 1 (korpa), E 3b (checkout) |
| Minimum 500 RSD | ✅ | E 3a („Dodajte još 300 RSD“, dugme blokirano), G `delivery minimum 500 RSD` |
| Nevalidna zona / „nije na spisku“ / zona ugašena u međuvremenu | ✅ | E 3a, E 5e, G `zone rules` |
| Napomena uz porudžbinu | ✅ | E 1 (vidi je lokal: karta, detalj u adminu, E 6b) |
| ŠTO PRE sa procenom min–max | ✅ | E 1 („stiže za 45–60 min“), U `ŠTO PRE shows the min–max estimate` |
| Zakazuje termin | ✅ | E 2 (sutra 12:00) |
| Termini na 30 min | ✅ | E 2 (sutra 09:30…00:30, svaki korak 30 min), U |
| Do 7 dana, bez nedelje, bez prošlih | ✅ | E 2 (Danas…Sre 30.09., bez 27.09.), U `7 days ahead`, U `server-side time validation` |
| Radno vreme (pre otvaranja, zatvaranje, posle ponoći, nedelja) | ✅ | U, G `opening hours on the server`, E 4 |
| Pauza u radnom vremenu | ✅ | U `break`, G `break from the HOURS sheet`, E 4 (poruka + bez termina 16:00/16:30/17:00), E 7b |
| Pauza svih porudžbina | ✅ | G, E 7b |
| Pauza dostave / pauza pickupa | ✅ | U, G `global pause, delivery off, pickup off`, E 7b |
| Nedostupan proizvod | ✅ | E 5e, E 7a (rasprodato vidljivo na meniju), G |
| Šalje porudžbinu | ✅ | E 1, 2 |
| Dupli klik | ✅ | E 5c, G `same requestId twice` |
| Dobija potvrdu i broj | ✅ | E 1 (#1001 „čeka potvrdu“), E 2 (#1002) |
| Vidi status (živo osvežavanje, link iz emaila) | ✅ | E 6a (✓ Primljena ● Potvrđena), E 6b (✓ … ✓ Završena) |
| Odbijena porudžbina | ✅ | E 6b („Odbijena, ništa ne plaćate“), G `reject` |
| Istekao rok od 5 min (kupac vidi da nije potvrđena) | ✅ | E 6b („Lokal još nije potvrdio… 064 227 4334“), G `overdue` |
| Ocena posle završetka | ✅ | E 6b (ocena obavezna, 5/5 + dobro/može bolje + komentar), G `guest feedback` (samo ZAVRŠENA, jednom, samo sa tokenom) |
| Otkazivanje samo telefonom | ✅ | nema dugmeta za otkazivanje; broj je klikabilan na potvrdi, statusu i u emailovima |

## Admin

| Stavka | Status | Dokaz |
|---|---|---|
| Login (pogrešan PIN, zaključavanje, istek sesije, falsifikovan token) | ✅ | E 6a, G `admin authentication` |
| Nova porudžbina | ✅ | E 6a |
| Vizuelni alert | ✅ | E 6a (žuta traka, naslov kartice „(n) NOVA PORUDŽBINA“), E 6b (crveno „kasne“) |
| Zvuk (ponavlja se, „Utišaj“, najviše 5 min) | ✅ | E 6a (brojač signala ≥ 1, „Utišaj“ gasi ponavljanje). Stvarni zvuk iz zvučnika nije slušan (headless). |
| Email lokalu | ✅ | G (karta svim primaocima posebno, rok 5 min, link na /admin/), E 1 (screenshot karte) |
| Prihvatanje | ✅ | E 6a, G |
| Odbijanje | ✅ | E 6b, G |
| 5-minutni rok | ✅ | E 6a (odbrojavanje), E 6b (KASNI), G `after 5 minutes … overdue` |
| Promena statusa (i nedozvoljeni skokovi, vraćanje koraka) | ✅ | E 6b, G `illegal jumps`, `mis-tap can be undone` |
| Detalji porudžbine | ✅ | E 6b (adresa, stan, sprat, napomena, dodaci, kusur) |
| Istorija i pretraga (broj, ime, telefon, datum, status) | ✅ | G `history search`, E 6b |
| Promena proizvoda, cene, opisa, kategorije | ✅ | E 7a, G `edit price, description, image and category` |
| Novi proizvod sa fotografijom | ✅ | E 7a (upload → Drive u emulatoru → slika na meniju), G `menu photos` |
| Dostupnost (rasprodato / skloni sa menija) | ✅ | E 7a, G `sold out (available) and hidden (active)` |
| Kategorije (dodaj, preimenuj, isključi, redosled) | ✅ | E 7a, G `categories` |
| Opcije / dodaci (nova, doplata, isključi, grupe) | ✅ | E 7a (Extra sir +120 odmah u meniju), G `add-ons` |
| Zone, cena dostave, minimum | ✅ | E 7b (300 RSD, min 600 → korpa traži još 240), G `zones` |
| Radno vreme i pauze | ✅ | E 7b, G `hours` (i objašnjene greške unosa) |
| Online ordering / Delivery / Pickup ON-OFF | ✅ | E 7b |
| Procena vremena | ✅ | E 7b (20–40 / 50–70 na sajtu i na serveru; „od > do“ odbijeno) |
| Dashboard | ✅ | E 6b, G `dashboard at the end of the day` |
| Feedback | ✅ | E 6b, G |
| Promena PIN-a | ✅ | G `PIN can be changed from the panel` |

## Podaci

| Stavka | Status | Dokaz |
|---|---|---|
| Dve porudžbine skoro istovremeno | ✅ u emulatoru | E 6c (paralelni zahtevi), G (lock se uzima i pušta oko svakog upisa). Emulator izvršava zahteve jedan po jedan, pa pravi LockService pod opterećenjem **nije testiran**. |
| Jedinstveni brojevi | ✅ | G `250 orders back to back` (#1001–#1250, 250 ID-jeva, bez rupa), E 6c |
| Nema duplog upisa | ✅ | G idempotencija (keš i fallback na tabelu), E 5b, 5c |
| Stare cene ostaju stare | ✅ | G `changing a price later never changes an existing order` (i naziv, i dodatak, i dostava) |
| Stare dostave ostaju stare | ✅ | isti test (zona 250 → 400, porudžbina ostaje 250) |
| Dodaci ostaju sačuvani | ✅ | G (ORDER_ITEMS: osnovna cena, cena dodataka, ID-jevi opcija, „BEZ“) |
| Total je tačan | ✅ | U pricing, G `forged client total`, E 1 (1.740 + 250 = 1.990) |
| Sheet podaci ispravni | ✅ | E 1, 2 (kolone ORDERS i ORDER_ITEMS), G |
| Statusi ispravni (vremena svakog statusa) | ✅ | G, E 6b (`Preparing At`, `Ready At`, `Completed At`) |
| Neuspešan upis ne troši broj | ✅ | G `Sheets write fails` |

## Responsive i kvalitet

| Oblast | Status | Dokaz |
|---|---|---|
| Telefon, tablet, desktop (375–1920 px) | ✅ | E 9: 10 stranica × 7 širina, 0 problema |
| Admin na telefonu, tabletu i desktopu | ✅ | E 9b: 13 sekcija + editor × 3 širine, 0 prelivanja, sva polja sa oznakom |
| Pristupačnost (lang, alt, imena dugmadi, labele, skip link, focus trap, Escape, vraćanje fokusa) | ✅ | E 9, 9b, 9c (automatski audit, nije ručni WCAG audit sa čitačem ekrana) |
| Performanse (prod build, telefon, Fast 4G, CPU 4×) | ✅ | `/`: LCP 700 ms, CLS 0 · `/meni/`: LCP 748 ms, CLS 0,089. Merenje je bilo noću, dok je lokal „zatvoren“, pa se pojavila traka „Trenutno ne primamo porudžbine“. U radno vreme ranije: 0,029. |
| SEO | ✅ | U `seo.test.mjs` |
| Bezbednost: sve cene, vreme, zone i dostupnost na serveru; escape u emailovima; zaštita od formula u Sheets-u; honeypot; rate limit; PIN heš + HMAC token; admin akcije samo sa tokenom; status i ocena samo sa tokenom porudžbine; podešavanja samo sa liste dozvoljenih ključeva | ✅ | G |
| Greške sa ljudskom porukom (internet, timeout, Apps Script, zatvoreno, pauza, zona, minimum, termin, stale korpa, server) | ✅ | E 3a, 3b, 4, 5a–5e, G |

## Produkcioni audit (29.09.2026)

Sistem je napadan kao da ga je pravio neko drugi: ručno složeni zahtevi na API, izmenjen localStorage, izgubljeni odgovori, dva admin uređaja, ceo radni dan 10:00–23:00 sa pauzom 15–16. Svaki nalaz ima test koji je pre ispravke padao ili opisuje stanje koje ranije nije bilo pokriveno.

| # | Nalaz | Težina | Ispravka | Dokaz |
|---|---|---|---|---|
| 1 | Admin sesija je ističala posle 12 h; lokal radi 09:00–01:00, pa bi se panel oko 21 h vratio na PIN usred gužve i prestao da javlja nove porudžbine | kritično | klizna sesija: server posle pola roka vraća nov token, panel ga čuva | G `sliding session`, E 6e |
| 2 | Odgovor izgubljen posle upisa + osvežavanje ili izmena forme = druga porudžbina | kritično | browser pamti nedovršeno slanje (heš, bez ličnih podataka), pre novog slanja i pri otvaranju pita `order.lookup` | G `order.lookup`, E 5f |
| 3 | Ponovljen zahtev posle isteka keša dobijao je „previše porudžbina“ / „zatvoreno“ / „cena promenjena“ umesto svoje porudžbine | srednje | svaka očekivana greška prvo proverava da li je taj `requestId` već upisan | G `retry after the rate limit` |
| 4 | Dva uređaja: „Odbij“ na zastarelom ekranu je odbijalo porudžbinu koju je drugi uređaj već prihvatio | srednje | panel šalje status koji je video, server vraća `CONFLICT` sa objašnjenjem | G `two devices`, E 6d |
| 5 | Promena PIN-a nije odjavljivala druge uređaje (izgubljen telefon ostaje prijavljen do 12 h) | srednje | token je potpisan i solju PIN-a | G `changing the PIN logs out` |
| 6 | Pogrešan trenutni PIN u „Promeni PIN“ nije ulazio u brojač pokušaja | srednje | isti brojač kao prijava (8 / 10 min) | G |
| 7 | `productId: "constructor"` je prolazio kao stavka od 0 RSD („1× Object“ na karti za kuhinju); akcija `constructor` je vraćala `ok` | srednje | mape bez prototipa, rute samo kao sopstveni ključevi | G `object-prototype names` |
| 8 | Polja pogrešnog tipa (objekat umesto napomene) upisivana kao „[object Object]“; gotovina 1070,5 prihvaćena | manje | `clean` prihvata samo tekst i broj, gotovina samo ceo nenegativan broj | G |
| 9 | Nepostojeći proizvod u korpi (npr. `constructor` u localStorage-u) rušio je checkout | manje | preporuke čitaju samo sopstvene ključeve i liste | E 5g |
| 10 | Izmenjen localStorage (qty „3“, 1e9, −4, „abc“) davao je pogrešne zbirove | manje | korpa popravlja ili izbacuje svaku liniju, max 20 | E 5g |
| 11 | „+“ u korpi na 20 komada nije radio ništa, bez objašnjenja; dodavanje preko 20 se tiho seklo | manje | dugme ugašeno sa objašnjenjem, poruka kad se dopuni do 20 | E 5g |
| 12 | Vraćanje koraka ZAVRŠENA → SPREMNA slalo je kupcu ponovo „Spremno je — možete da dođete“ | srednje | email „spremna“ samo prvi put | G `pickup "spremna" email goes out once` |
| 13 | Emailovi kupcima trošili su poslednju dnevnu kvotu, pa kuhinja nije dobijala porudžbine | srednje | 10 slanja rezervisano za kuhinju, upozorenje u panelu ispod 25 | G `daily email quota` |
| 14 | Test režim uključen pri puštanju u rad vidi se samo u Podešavanjima: kuhinja tiho ne dobija emailove | srednje | crvena traka na Pregledu i Novim porudžbinama | — |
| 15 | Jednoredni upisi (logovi, kontakt, posao) bez lock-a računali su „poslednji red + 1“: dva istovremena upisa mogla su da pregaze jedan drugog | srednje | `appendRow` (atomičan u Sheets-u) | G (sve postojeće) |
| 16 | „Nazad“ posle poručivanja: stranica iz bfcache-a zadržava staru korpu i može da je vrati | srednje | `pageshow` ponovo čita korpu | E 5h |
| 17 | Kuhinjski tablet sa zaključanim ekranom usporava panel (tajmeri 1×/min) | srednje | Screen Wake Lock dok je panel otvoren + uputstvo | — (pravi uređaj) |
| 18 | Dugmad statusa u panelu nisu bila vezana za serverska pravila | manje | crtaju se samo iz `next` sa servera | G matrica 6×6 |
| 19 | Nove porudžbine primljene u istoj sekundi bile su poređane od starije | manje | sekundarno po broju | — |
| 20 | Kartica „Isto kao prošli put“ pisala je „1× Klasik, 1× Klasik“ | manje | „2× Klasik“, nepostojeći proizvodi se preskaču | — |
| 21 | Mrtav kod: `setProductAvailability_`, `uuid_`, `replaceLine`, `productsIn`, `fromHTML`, `closeAll` | manje | uklonjeno | — |

Pregledano bez nalaza: server-side cene/dostava/total (1 RSD, 0, negativno, string, lažne cene u stavkama), 7./8. dan, prošlost, pauza, van radnog vremena, pauzirani kanali, zone (neaktivna, nepostojeća, velika slova), minimum 499/500/501, istorijske cene proizvoda, dodatka i dostave posle izmene, 6×6 matrica statusa, rok od 5 min (4:59 / 5:01 / prihvaćeno kasno / odbijeno), escape u emailovima i panelu, formule u Sheets-u, tajne u bootstrap-u, stack trace u greškama, integritet ORDERS ↔ ORDER_ITEMS ↔ CUSTOMERS posle mešovitog dana, 0 grešaka u konzoli i 0 neuspelih zahteva na 10 stranica × 7 širina + admin.

## Nije testirano

- **Pravi Google nalog**: Sheets, MailApp, LockService pod stvarnim paralelnim opterećenjem, okidači, Drive dozvole. Sve je testirano u emulatoru koji izvršava pravi `.gs` kod. Deploy i provera su u SETUP.md.
- **Javni link fotografije sa Drive-a** (`lh3.googleusercontent.com/d/{id}`): u emulatoru se slika služi lokalno. Na pravom nalogu treba proveriti u anonimnom prozoru. Rezervni format je u SETUP.md.
- **Prikaz emailova** u Gmail i Outlook aplikacijama: HTML je tabelaran sa inline stilovima, proveren samo u pregledaču.
- **iOS Safari** na pravom uređaju (samo Chromium emulacija telefona) i **zvuk iz zvučnika** tableta (Web Audio je pozvan, ali headless Chrome ga ne pušta).
- **GA4** događaji (kod postoji, aktivira se unosom GA4 ID-a).
- **Pravi paralelni zahtevi** na Apps Script: emulator izvršava zahteve jedan po jedan. Zaštita (ScriptLock oko broja i upisa, `appendRow` za pojedinačne redove, ponovna provera `requestId` pod lock-om) je proverena kodom i testovima redosleda, ne stvarnim istovremenim izvršavanjem.
- **Screen Wake Lock** i ponašanje panela sa zaključanim ekranom na pravom tabletu.
- **Back/forward cache** na produkcionom hostingu: dev server šalje `no-cache`, pa je povratak iz keša simuliran događajem `pageshow`.

## Bagovi pronađeni i ispravljeni u ovoj rundi

1. **Ekran proizvoda na desktopu**: kod proizvoda sa mnogo opcija red u gridu je rastao sa sadržajem, pa ilustracija nije bila vidljiva. Panel je sada flex kolona od 94vh, a opcije skroluju unutar kolone.
2. **CLS menija 0,155**: izbor naselja se pojavljivao tek posle JavaScript-a. Traka je sada prerenderovana istog oblika.
3. **Admin na telefonu**: gornja traka se prelamala u 4 reda (~250 px), a lepljiva traka „nova porudžbina“ prekrivala je navigaciju. Traka je sada jedan red, navigacija se lepi tačno ispod nje, a upozorenje je u toku strane.
4. **Admin, radno vreme**: skriveni natpisi za čitače ekrana u tabeli širili su celu stranu za 542 px (apsolutno pozicioniranje van skrol okvira). Okvir tabele je sada `position: relative`.
5. **Admin forme**: podaci koji stignu sa servera ponovo su iscrtavali formu i brisali upisanu vrednost. Iscrtava se samo kad se podaci stvarno promene.
6. **Polja za vreme** su u pregledaču na engleskom prikazivala AM/PM. Sada su tekstualna polja u 24-časovnom obliku.
7. **Rezime termina** je koristio sat telefona umesto vremena servera („24.09.“ umesto „sutra“).
8. **Paralelni test procesi** su istovremeno prepisivali generisane `Shared_*.gs` fajlove i ponekad čitali pola fajla. Upis je sada atomski i samo kad se sadržaj promeni.
9. **Brojač posle testiranja** bi prvu pravu porudžbinu označio npr. #1007. Dodato je „Vrati brojač na početak“, dozvoljeno samo kad je ORDERS prazan.
10. **Istorija, trka zahteva**: pretraga bez filtera koja se pokrene pri otvaranju sekcije mogla je da stigne posle pretrage koju je lokal ukucao i da je pregazi (E 6b je jednom pao). Sada se prikazuje samo odgovor na poslednji zahtev.

Bagovi iz prve runde (radio labele, fokus u dijalogu, fioke, vreme popunjavanja, rupa u brojevima, dijakritici, poređenje vremena kao teksta, rod reči „rasprodat“, top proizvod po prihodu) ostaju ispravljeni i pokriveni istim testovima.
