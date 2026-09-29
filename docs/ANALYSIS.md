# Grčki Giros — analiza pre implementacije

Datum: 23.09.2026. Izvori, redom težine:

1. `GIROS_GrckiGiros.pdf` — Master Project Document (13 strana, 27 sekcija), potpis klijenta 9.9.2026.
2. `Podaci-za-sajtove-Tontic-Lux-i-Grcki-Giros.docx` — sirovi odgovori klijenta (G1–G48), iz kojih je PDF nastao.
3. Prompt naručioca (73 tačke) — noviji od PDF-a, eksplicitan o tehnologiji i obimu.
4. https://gyros.rs — funkcionalna referenca (istražena: početna, kategorija, proizvod, korpa, checkout, cenovnik).
5. https://joseph-berry-webflow-master-class.webflow.io — vizuelna/interakciona referenca (svih šest stranica + IX2 konfiguracija).

---

## 1. Činjenice iz PDF-a (potvrđene od klijenta)

| Oblast | Vrednost |
|---|---|
| Naziv | GRČKI GIROS (G1), domen `grckigiros.rs` |
| Grad | Novi Sad |
| Od kada | 2021. |
| USP | pita stiže iz Atine, velike porcije, grčki začini, brza usluga |
| Adresa (lokal 1) | Dimitrija Tucovića 3, tel. 064 2274334 |
| Radno vreme | pon–sub 09:00–01:00, **nedelja ne radi** |
| Dostava | preko agencije, ~60 min, 10:00–00:00, zone i cenu određuje agencija, nema besplatne dostave |
| Pre-order | da, najviše 2 h unapred, isti dan |
| Preuzimanje | da, spremno za 15 min (do 30 u špicu), gost vidi procenu |
| Plaćanje | samo gotovina (kuriru ili u lokalu), bez kartice |
| Minimalna porudžbina | nema |
| Sastavljanje | meso (obavezno: pileće/svinjsko/mešano), pita (obavezno), sosovi/salate/začini bez doplate i bez limita, extra meso uz doplatu, "bez sastojka" postoji, napomena gosta postoji |
| Lokal | potvrđuje porudžbinu pre pripreme, zvučni signal, radnik isključuje rasprodato, Ognjen menja cene kroz Google Sheets |
| Posao | prodavac-kuvar, dve smene, prijave na svetislavtontic@gmail.com i milica.tontic70@gmail.com, CV neobavezan |
| Promo | Giros + sok 0.33 (cena nedostaje) |
| Paleta | bela, mediteran plava #1B4F8C, zlatna #F5A623, tamno siva #2D2D2D |
| Izbegavati | tamnu pozadinu za hranu, tekstualno pretrpan meni, teške animacije, Glovo-template, pretvaranje u luksuzni restoran |

## 2. Konflikti i odluke

| # | Konflikt | Odluka | Zašto |
|---|---|---|---|
| D1 | PDF: 2 lokala. Prompt: jedan lokal, bez multi-location UI. | **Jedan lokal** (Dimitrija Tucovića 3). Lokal 2 se ne prikazuje. Model podataka nosi `location_id` (`GG-01`) da se drugi lokal kasnije doda bez migracije. | Prompt je noviji i tri puta eksplicitan; za Lokal 2 nema telefona i nije jasno da li radi (N5, N8). PDF sam kaže da se prazan telefon ne prikazuje. |
| D2 | PDF: Next.js + Supabase + Sendgrid. Prompt: HTML/CSS/JS + Google Sheets + Apps Script. | **Prompt.** PDF-ov zahtev "sajt radi bez JS-a (SSR)" ispunjen je prerenderom statičkog HTML-a u build koraku. | Nula mesečnih troškova, Sheets je ionako alat kojim Ognjen menja cene. |
| D3 | Naslov PDF-a pominje "Master Giros"; gyros.rs je brend "Gyros Master". | Svuda **Grčki Giros**. Ništa od Gyros Master brenda se ne preuzima. | G1 + domen. K1 ostaje otvoreno pitanje za klijenta samo formalno. |
| D4 | PDF: Instagram `friendsandfoodns`. Upitnik: `friends_and_foodns`. | `https://www.instagram.com/friends_and_foodns/` | PDF je markdownom izgubio donje crte (vidi se kurziv "and"). |
| D5 | K3: pomfrit stoji u grupi "Meso" sa da/ne. | **"Pomfrit u piti: da/ne"** kao opcija sastavljanja (podrazumevano da), plus pomfrit kao zaseban prilog. | Grčki giros standardno ima pomfrit u piti; gyros.rs ima baš "Bez pomfrita". Oba scenarija pokrivena, klijent samo potvrđuje. |
| D6 | PDF: posebna stranica `/giros` za sastavljanje. | Sastavljanje je **product sheet** otvoren iz menija (i direktan link `/meni/?p=slozi-svoj`). | Jedna mentalna mapa: meni = mesto poručivanja. Nema skoka između stranica, korpa ostaje u kontekstu. |
| D7 | PDF: zona se proverava PRE sastavljanja; zone određuje agencija (nepoznate). | Traka **Dostava / Preuzimanje** na vrhu menija, pre izbora jela. Ako su zone uključene u `ZONES`, gost bira naselje odmah tu i dobija da/ne + cenu. Podrazumevano jedna zona "Novi Sad". | Ključni UX fix iz PDF-a, a ne komplikuje današnji UX dok zone ne postoje. |
| D8 | Cenu dostave određuje agencija; prompt traži DELIVERY i TOTAL + kusur. | Dva režima u `SETTINGS.delivery_fee_mode`: `fixed` (cena iz zone ulazi u total i u kusur — podrazumevano) i `agency` (prikazuje se "po cenovniku dostavne službe", ne ulazi u total). | gyros.rs radi kao `agency` (Dostava 321, poseban fiskalni račun). Kusur je tačan samo ako je cena poznata, zato je `fixed` podrazumevan; iznos čeka N11/N12. |
| D9 | Prompt primer 10–22h. PDF 09–01, dostava 10–00. | Vrednosti iz PDF-a u `HOURS`. **Poslovni dan prelazi ponoć** (subota 09:00 → nedelja 01:00), granica dana 06:00. | Porudžbina u 00:30 pripada prethodnom radnom danu u statistici i izveštajima. |
| D10 | Prompt: termini do zatvaranja. PDF: najviše 2 h unapred. | Prvi termin = sada + 60 min (prompt), korak 30 min, zaokruženo naviše na 5 min, **najviše 120 min unapred** (PDF), nikad posle zatvaranja. Sve u `SETTINGS`. | Operativno pravilo je klijentovo; mehanika termina je iz prompta. |
| D11 | Prompt: kusur je obavezan. | Pitanje "Sa koliko novca plaćate?" je obavezno **za dostavu**. Za preuzimanje: "Plaćate gotovinom na kasi". | Kusur priprema dostavljač; na kasi je kusur trivijalan. Prompt-ovi tokovi 65/66 isto razdvajaju. |
| D12 | PDF P0: lokal panel na tabletu sa zvukom i potvrdom. Prompt ga ne pominje. | `/panel/` — PIN, osvežavanje na 10 s, zvuk, statusi (NEW→…→COMPLETED), rasprodato, pauza, "gužva +15 min". | Bez panela statusi iz prompta nemaju ko da menja; PDF ga vodi kao P0. Namerno lean, bez CMS-a. |
| D13 | PDF P0: email potvrda kupcu. Prompt: email opcion. | Email je opcion; ako ga gost unese, dobija potvrdu. | Bez frikcije za one koji ne žele. |
| D14 | PDF: /lokacije, /kontakt, /faq, /dostava odvojeno. | `/kontakt` = lokacija + mapa + forma. `/dostava` = dostava, preuzimanje, plaćanje + FAQ (FAQPage schema). | Jedan lokal; tanke stranice ne pomažu ni SEO-u ni gostu. |
| D15 | Fotografije: "imamo za neka jela", fotografija lokala nema. | Svaki proizvod ima `image` slot (WebP, srcset). Dok slike ne stignu, dizajn nosi **ilustrovani sistem** (SVG), ne stock i ne AI fotografije predstavljene kao njihova hrana. | Autentičnost je USP; lažna fotografija je rizik za brend. |
| D16 | Prompt primer kategorija sadrži burgere i deserte. | Demo meni prati PDF (giros, porcije, paketi, prilozi, salate, sosovi, piće). Kategorije su konfiguracija. | "Nemoj dodavati samo radi efekta." |
| D17 | "Koliko je novca doneo sajt". | Prihod = zbir **hrane** (međuzbir) za porudžbine koje nisu CANCELLED/FAILED. Dostava se vodi odvojeno. | Dostavu naplaćuje agencija; nije prihod lokala. Prekidač `revenue_includes_delivery`. |
| D18 | Prompt: 3D, parallax, magnetic… PDF: bez kompleksnih animacija. | Bez GSAP/Lenis/WebGL. Vanilla + CSS 3D + WAAPI, ~0 KB biblioteka. | JB "3D Experience" je i sam CSS 3D (perspective + preserve-3d), ne WebGL. |

## 3. Šta nedostaje (PDF sekcija 24) i kako sistem to podnosi

| # | Nedostaje | Stanje u sistemu |
|---|---|---|
| N1–N3 | meni, kategorije, cene | **Stiglo 29.09.2026** (rukom pisan meni): giros veliki/mali/porcija/vege, akcije, pljeskavice i roštilj, pomfrit, premazi, piće. U `data/seed.json`; demo meni je premešten u `tests/fixtures/seed.demo.json` i služi samo testovima. |
| N4 | naziv lokala | Nije potreban (jedan lokal). |
| N5, N8 | Lokal 2 | Adresa stigla (Bulevar kralja Petra I 61). Prikazuje se samo kao informacija na stranici Kontakt (`SETTINGS.second_location`); poručivanje i dalje ide preko jednog lokala (D1). |
| N6 | jela bez dostave | Kolona `delivery` u `PRODUCTS`. |
| N7, N14 | fotografije | Stiglo: giros, pljeskavica, gurmanska, banjalučki ćevap, kobasica, ražanj, logo. Ostali proizvodi koriste ilustracije (D15). |
| N9 | plata | Polje se prikazuje samo ako je uneto u `SETTINGS.job_salary`. |
| N10 | cena promo komboja | Giros veliki + Coca-Cola 650, giros mali + Coca-Cola 550, pljeskavica velika + Coca-Cola 550. |
| N11, N12 | zone, agencija | `ZONES` + `delivery_fee_mode` (D7, D8). |
| N13 | extra meso | „Meso plus 100 g“ 330 RSD. |
| N15 | pomfrit | D5. |

## 4. gyros.rs — šta je korisno, šta popravljamo

Stack: WordPress + WooCommerce + Elementor + YITH add-ons, ~40 skripti, jQuery, četiri trackera.

**Uzimamo (princip, ne dizajn):**
- Sastavljanje po grupama (meso, pita/tortilja, premazi, salate, začini, posebni zahtevi) sa cenom koja se menja u hodu.
- "Bez pomfrita" kao eksplicitna opcija → potvrđuje D5.
- Kategorije kao glavna navigacija menija; cenovnik kao jedna čitljiva lista.
- Pregled porudžbine prikazuje sve izabrane opcije.
- Telefon za porudžbine i "Tražiš posao?" u footeru.

**Popravljamo:**
- Meso je checkbox (može 0 ili 3) → kod nas radio, obavezno, jasno označeno.
- Nema podrazumevanih sastojaka, gost štiklira sve ručno → kod nas "Klasik"/"Ljutko"/"Atina" kao gotove kombinacije, "Složi svoj" za one koji hoće sve sami; kartica gosta prikazuje samo razlike (+ dodato, BEZ …).
- Lista proizvoda bez slike i opisa → slika/ilustracija + jedna rečenica.
- Zona i cena dostave se saznaju na kraju → kod nas na početku (D7).
- Checkout traži email, prezime posebno i obaveznu napomenu → kod nas samo ime, telefon, adresa za dostavu; email i napomena opcioni.
- Nema preuzimanja, vremena ni kusura u checkoutu → sve tri stvari postoje.
- Težak sajt → cilj < 100 KB JS+CSS, bez biblioteka.

## 5. Joseph Berry referenca — rečnik pokreta

Izvučeno iz Webflow IX2 konfiguracije (812 akcija): dominantno trajanje **500 ms**, zatim 1000/1500 ms; easing **outQuart / inOutQuart**; tipovi: pomeranje (425), opacity (252), size (74), scale (63), rotate (29); 70 hover parova, 29 scroll-into-view, 12 mouse-move (samo desktop), 14 page-start.

| Stranica | Tehnika | Kod nas |
|---|---|---|
| Main | maskirani text reveal, marquee koji prati scroll, lista sa hover slikom, magnetna dugmad, wipe paneli pri prelazu stranice | reveal naslova, USP marquee, magnetni primarni CTA (desktop), kratki page-transition wipe u plavoj |
| 3D Experience | CSS `perspective:1000px` + `preserve-3d`, naginjanje prema mišu, rotirajući kružni badge | slojevita giros ilustracija sa CSS 3D nagibom (desktop miš, mobile blagi scroll parallax), badge "Pita stiže iz Atine" |
| Click Card | kartica se širi u detalj (shared element) | kartica proizvoda → product sheet FLIP animacija slike |
| Scroll Jack | 800vh sticky scena, horizontalni niz slika, brojevi 01→02→03 | "Kako radi" 01/02/03 u sticky sceni ≤ 250vh, samo desktop; mobile običan tok |
| Bonus Content | linija-po-linija reveal iz maske | naslovi sekcija |
| Hall of Fame | preveliki grid koji se pomera mišem | ne koristimo — nema svrhu u poručivanju |

**Odbacujemo:** blokirajući preloader sa "Enter" (ubija konverziju), custom kursor (smeta klikanju na mobilnom i u formama), 800vh scroll-jack (gladan korisnik ne skroluje osam ekrana), smooth-scroll biblioteke (lome sticky meni i anchor skokove).

Paleta reference (krem #F4F0E3, plava #2E36CB, žuta #FFCB30, tekst #292929) je strukturno ista kao PDF paleta — potvrda da plavo/zlatno/toplo belo nosi premium osećaj bez tamne pozadine.

## 6. Rizici

1. **Email kvota.** Besplatan Gmail nalog: Apps Script šalje najviše **100 primalaca dnevno**. Tri primaoca po porudžbini = ~33 porudžbine dnevno, a PDF primer izveštaja ima 37. Rešenje: Google Workspace (1.500/dan) ili jedan primalac + Gmail prosleđivanje. Sistem proverava preostalu kvotu i pada na primarnog primaoca, a panel je primarni kanal za kuhinju.
2. **Apps Script latencija** 0,5–3 s po pozivu (hladan start). Meni se renderuje iz statičkog snapshot-a odmah, živi podaci stižu posle; porudžbina ima jasan "šaljemo" status i bezbedan retry (idempotencija).
3. **Nema tableta u lokalu** (G30). Bez uređaja koji je stalno upaljen, porudžbina se oslanja na email. Preporuka klijentu: bilo koji Android tablet + panel.
4. **Cena dostave nepoznata** → kusur tačan tek kada se unese cena zone (D8).
5. **Fotografije** → D15.
6. **Apps Script nema pristup IP adresi ni Origin headeru** → rate limit po telefonu i globalno, honeypot, vremenski prag, idempotencija; origin provera nije moguća u ovoj arhitekturi (dokumentovano, ne glumi se).
