# Postavljanje u produkciju

Trajanje: ~45 minuta. Troškovi: 0 RSD mesečno (domen se plaća posebno).

```
Kupac ──► sajt (Cloudflare Pages, statički) ──► Apps Script Web App ──► Google Sheets
                                                      ├─► Gmail (karta za kuhinju, emailovi kupcu, izveštaji)
Lokal ──► /admin/ (tablet, telefon, računar) ─────────┤
                                                      └─► Google Drive (fotografije menija, CV prijave)
```

## 0. Pre početka

- Google nalog lokala na kome će biti tabela i sa kog idu emailovi. **Preporuka: Google Workspace** (1.500 email primalaca dnevno). Besplatan Gmail ima limit od **100 primalaca dnevno**. Svaka porudžbina troši 1 primaoca po popunjenoj adresi iz `EMAIL_1`…`EMAIL_4` i, ako je kupac ostavio email, još do 3 (primljena, potvrđena, spremna/odbijena). Sa jednom kuhinjskom adresom to je ~25–50 porudžbina dnevno. Poslednjih 10 slanja u danu čuva se za kuhinju: emailovi kupcima tada prestaju prvi, a kuhinjska karta ide bar prvom primaocu. Sve se loguje, a admin panel na Pregledu i Novim porudžbinama upozorava kad ostane manje od 25. Porudžbine se uvek vide u admin panelu, nezavisno od emaila.
- Node.js 20+ na računaru koji pravi build.

## 1. Google Sheets + Apps Script

Preko `clasp` (zvanični Google alat, već je u `devDependencies`). Tabela već postoji, pa se skripta **vezuje za nju**: `--parentId` je ID iz adrese tabele. Ne koristiti `--type sheets`, to pravi novu, praznu tabelu.

```powershell
npm install
npx clasp login
npx clasp create-script --parentId <ID-tabele> --rootDir backend/apps-script
npm run build
npx clasp push --force
npx clasp create-deployment --description "v1"
```

Pre prvog `clasp push` uključite **Apps Script API** na script.google.com/home/usersettings. `npm run build` generiše `Shared_*.gs` i `Seed.gs`. `create-deployment` ispisuje deployment ID, a Web App adresa je `https://script.google.com/macros/s/<deploymentId>/exec`. U editoru (**Deploy ▸ Manage deployments**) proverite *Execute as: Me*, *Who has access: Anyone*. `.clasp.json` u korenu projekta čuva `scriptId` i `rootDir`.

Trenutna instalacija (30.09.2026): tabela `199ZuKxJ1hxpUqTZsDV65E7a484UZ7mVdQqmEdNowthI`, deployment `AKfycbzOPrgRpv8TJ4hiQVoWn850kPJMzVW2R1Sl1z2sukQR-di_dwtyn374gXQBStE91_yeAw`.

Bez clasp-a: napravite Google tabelu → **Extensions ▸ Apps Script** → za svaki `.gs` fajl iz `backend/apps-script/` napravite fajl istog imena i nalepite sadržaj (`appsscript.json` se vidi kad u Project Settings uključite „Show manifest file“).

U tabeli (osvežite je, pojaviće se meni **Grčki Giros**):

1. **Grčki Giros ▸ 1. Prvo podešavanje**. Google traži dozvole: Sheets, slanje emaila, Drive (fotografije menija i CV), okidači. Pravi se 23 lista sa podacima iz `data/seed.json`, uključujući FEEDBACK i kolone za pauzu u HOURS.
2. **Grčki Giros ▸ 3. Postavi PIN za admin panel**: 6 do 8 cifara.
3. List **SETTINGS**: `EMAIL_1`…`EMAIL_4` su adrese za sva obaveštenja lokala (porudžbine, kontakt, prijave za posao sa CV-jem u prilogu, izveštaji). `EMAIL_1` je obavezan, prazan slot se preskače bez greške, a novoupisana adresa važi bez izmene koda. Zatim `site_url`, `phone_*`, `address_*` i `map_url` (link lokala na Google Maps za dugmad „Otvori u mapama“; prazno = pretraga po adresi iz `map_query`). `test_mode` ostaje **TRUE** do kraja testiranja (svi emailovi idu samo na `test_email_recipient`, ili vlasniku skripte ako je prazno). Novi ključevi i njihove početne vrednosti:
   - `order_number_start` (1001)
   - `accept_timeout_min` (5)
   - `preorder_days` (7)
   - `delivery_eta_min`/`delivery_eta_max` (45/60)
   - `pickup_eta_min`/`pickup_eta_max` (15/30)
   - `min_order_delivery` (500)
   - `customer_status_emails` (TRUE)
   - `image_url_template`
4. List **ZONES**: prave zone, cene i minimum. Seed zone su **DEMO** dok agencija ne potvrdi cene. Meni (PRODUCTS, OPTIONS…) je pravi, sa rukom pisanog menija od 29.09.2026.
5. Izveštaji idu na iste `EMAIL_1`…`EMAIL_4` adrese; poseban spisak primalaca više ne postoji.
6. U Apps Script editoru: **Deploy ▸ New deployment ▸ Web app**, *Execute as: Me*, *Who has access: Anyone*. Kopirajte URL koji se završava sa `/exec`.
7. **Grčki Giros ▸ 2. Instaliraj automatiku**: dnevni izveštaj ~01:00, nedeljni ponedeljkom, mesečni 1. u mesecu, dashboard na 10 min, noćno održavanje ~04:30.

Kasnije izmene koda: `npm run build`, `npx clasp push --force`, pa `npx clasp update-deployment <deploymentId>` (URL ostaje isti).

Izmene u listovima (SETTINGS, HOURS, PRODUCTS…) važe odmah kad ih okidač `onEdit` uhvati, a najkasnije za 60 s (keš). Brisanje ćelije tasterom Delete ne pokrene uvek `onEdit`, pa tada važi tih 60 s.

## 2. Sajt

```powershell
npm install
# site.config.json → "apiUrl": "https://script.google.com/macros/s/…/exec"
npm run sync      # povuče živi meni, zone i radno vreme iz tabele u data/snapshot.json
npm run build     # → dist/
```

Hosting (besplatno): **Cloudflare Pages**. Novi projekat, „Direct upload“ foldera `dist/`, ili povezivanje Git repoa sa build komandom `npm run build` i izlazom `dist`. `_headers` (keš, bezbednosna zaglavlja, `noindex` + `no-store` za `/admin/`) već je u buildu. Domen: Custom domains ▸ dodati domen, pa kod registratora DNS zapise koje Cloudflare prikaže. HTTPS je automatski.

Meni, cene, dostupnost, zone, radno vreme i procene sajt uvek čita iz tabele (preko Apps Script-a, keš 60 s). Ponovni build treba samo da bi statički HTML za Google i posetioce bez JavaScript-a video nove cene: jednom nedeljno ili posle većih izmena menija.

## 3. Test pre puštanja (test_mode = TRUE)

| Korak | Očekivano |
|---|---|
| Meni ▸ Grčki Giros ▸ Pošalji test porudžbinu | Email „[TEST] #1042 · DOSTAVA…“ sa crvenom trakom „Prihvatite ili odbijte u roku od 5 min“ |
| Na sajtu poručite dostavu: naselje, adresa sa stanom i spratom, 2.000 RSD, vaš email | Potvrda **#1001 — čeka potvrdu**, red u ORDERS (status NEW, `Accept By` +5 min), email kuhinji, email kupcu „Primili smo porudžbinu“ |
| Otvorite `…/admin/` na tabletu, PIN | Žuta traka, zvuk na 20 s, kartica #1001 sa odbrojavanjem |
| **Prihvati** | Kupac na stranici statusa vidi „✓ Primljena ● Potvrđena“, email „Porudžbina #1001 je potvrđena“ |
| U pripremu → Spremna → Isporučeno | Kolone Aktivne, vremena u ORDERS (`Preparing At`, `Ready At`, `Completed At`), kupac vidi „Završena“ i formu za ocenu |
| Ocenite porudžbinu na stranici statusa | Red u FEEDBACK, ocena u admin ▸ Feedback |
| Poručite preuzimanje za sutra u 12:00 | #1002, „ZAKAZANO četvrtak … u 12:00“ u emailu i ORDERS (`Scheduled Date`/`Time`) |
| Ne prihvatajte #1002 5 minuta | Kartica crvena „KASNI … pozovite kupca“, kupac vidi „Lokal još nije potvrdio… pozovite“ |
| **Odbij** #1002 | Kupac vidi „Odbijena, ništa ne plaćate“, email „nije prihvaćena“ |
| Admin ▸ Proizvodi: promenite cenu, dodajte fotografiju | Nova cena i fotografija na meniju za ≤ 1 min. Fotografija u Drive folderu „Grčki Giros — slike menija“ |
| Admin ▸ Dostupnost: isključite dostavu, pa sve porudžbine | Meni vidljiv, poručivanje zatvoreno sa jasnom porukom |
| Admin ▸ Radno vreme: pauza za danas | Tokom pauze „Trenutno ne primamo porudžbine… pauza“, posle nje samo nastavlja |
| Meni ▸ Pošalji dnevni izveštaj za juče | Izveštaj stiže na test adresu |

**Fotografija sa Drive-a:** otvorite adresu slike iz polja „Fotografija“ u pregledaču u kome **niste** prijavljeni na Google (anonimni prozor). Ako se slika ne prikaže, u SETTINGS promenite `image_url_template` u `https://drive.google.com/thumbnail?id={id}&sz=w1000`. Lokalno je ovaj korak testiran samo sa emulatorom (vidi QA-CHECKLIST, „Nije testirano“).

Kada sve prođe:

1. Obrišite test redove iz ORDERS, ORDER_ITEMS, CUSTOMERS i FEEDBACK.
2. **Grčki Giros ▸ Vrati brojač na početak (samo pre puštanja)**. Radi samo kad je ORDERS prazan. Sledeća porudžbina je ponovo #1001.
3. `test_mode` = **FALSE**.

## 4. Posle puštanja

- **Tablet u lokalu**: Android tablet sa Chrome-om, `grckigiros.rs/admin/`, „Dodaj na početni ekran“, ekran uvek uključen, zvuk uključen (jedan dodir na ekran posle otvaranja).
- **Uputstvo za zaposlene**: `docs/UPUTSTVO-ZA-LOKAL.md` (odštampati).
- **Stanje sistema** (meni u tabeli): preostala email kvota, PIN, okidači, poslednji izveštaj.
- Greške: listovi `ERROR_LOG` i `SYSTEM_LOG` (automatski skraćeni na 5.000 redova).

## Poznata ograničenja arhitekture

- Apps Script ne vidi IP adresu ni Origin zaglavlje. Zaštita čine rate-limit po telefonu i globalno, honeypot, minimalno vreme popunjavanja, idempotencija i serverska validacija svega.
- Jedna porudžbina u isto vreme: upis i broj idu pod `LockService` script lock (čeka do 20 s). Pri velikom broju istovremenih porudžbina ostali dobijaju „pokušajte ponovo za nekoliko sekundi“, ne duplikat.
- Apps Script odgovara sporo: izmereno 30.09.2026. bootstrap 2,3–6,4 s, porudžbina 5–8 s (upis i emailovi), CV prijava ~8 s. Na hladnom startu i duže. Meni se zato prikazuje odmah iz keša ili snapshot-a, a slanje porudžbine ima jasan status i bezbedan ponovni pokušaj.
- Admin panel proverava nove porudžbine na svakih 10 s (`panel_poll_seconds`). Zvuk radi samo dok je panel otvoren u pregledaču. Email je rezervni kanal.
- Okidači imaju ±15 minuta tolerancije (Google).
