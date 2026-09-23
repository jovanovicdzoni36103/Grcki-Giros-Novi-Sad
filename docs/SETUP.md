# Postavljanje u produkciju

Trajanje: ~45 minuta. Troškovi: 0 RSD mesečno (domen se plaća posebno).

```
Gost ──► sajt (Cloudflare Pages, statički) ──► Apps Script Web App ──► Google Sheets
                                                     └─► Gmail (karte za kuhinju, izveštaji)
Lokal ──► /panel/ na tabletu ─────────────────────────┘
```

## 0. Pre početka

- Google nalog lokala na kome će živeti tabela i sa kog idu emailovi. **Preporuka: Google Workspace** (1.500 email primalaca dnevno). Besplatan Gmail ima limit od **100 primalaca dnevno** — sa tri primaoca po porudžbini to je ~33 porudžbine dnevno, posle čega sistem šalje samo prvom primaocu (i to loguje). Alternativa: jedan primalac + Gmail pravilo za prosleđivanje.
- Node.js 20+ na računaru koji pravi build.

## 1. Google Sheets + Apps Script

Najbrže preko `clasp` (zvanični Google alat):

```powershell
npm install -g @google/clasp
clasp login
cd backend/apps-script
clasp create --type sheets --title "Grčki Giros — porudžbine" --rootDir .
npm run build            # iz korena projekta: generiše Shared_*.gs i Seed.gs
clasp push
```

Bez clasp-a: napravite novu Google tabelu → **Extensions ▸ Apps Script** → za svaki fajl iz `backend/apps-script/` napravite fajl istog imena i nalepite sadržaj (`appsscript.json` se vidi kad u Project Settings uključite „Show manifest file“).

Zatim u tabeli (osvežite je, pojaviće se meni **Grčki Giros**):

1. **Grčki Giros ▸ 1. Prvo podešavanje** — Google traži dozvole (Sheets, Gmail slanje, Drive za CV, okidači). Pravi se 22 lista sa podacima iz `data/seed.json`.
2. **Grčki Giros ▸ 3. Postavi PIN za panel** — 6 do 8 cifara.
3. List **SETTINGS**: proverite `order_email_recipients`, `contact_email_recipients`, `jobs_email_recipients`, `site_url`, `delivery_fee_default`. `test_mode` ostaje **TRUE** do kraja testiranja (svi emailovi idu samo na `test_email_recipient`, ili na vlasnika skripte ako je prazno).
4. List **REPORT_CONFIG**: `report_recipients`.
5. U Apps Script editoru: **Deploy ▸ New deployment ▸ Web app** — *Execute as: Me*, *Who has access: Anyone*. Kopirajte URL koji se završava sa `/exec`.
6. **Grčki Giros ▸ 2. Instaliraj automatiku** — dnevni izveštaj ~01:00, nedeljni ponedeljkom, mesečni 1. u mesecu, dashboard na 10 min, noćno održavanje ~04:30. Ovo se radi jednom; posle toga promene sati u `REPORT_CONFIG` noćno održavanje samo primenjuje.

Kasnije izmene koda: `clasp push`, pa **Deploy ▸ Manage deployments ▸ Edit ▸ New version** (URL ostaje isti).

## 2. Sajt

```powershell
npm install
# site.config.json → "apiUrl": "https://script.google.com/macros/s/…/exec"
npm run sync      # povuče živi meni i radno vreme iz tabele u data/snapshot.json
npm run build     # → dist/
```

Hosting (besplatno): **Cloudflare Pages** — novi projekat, „Direct upload“ foldera `dist/` ili povezivanje Git repoa sa build komandom `npm run build` i izlazom `dist`. Fajl `_headers` (keš i bezbednosna zaglavlja) već je u buildu. Domen `grckigiros.rs`: Custom domains ▸ dodati domen, pa kod registratora postaviti DNS zapise koje Cloudflare prikaže. HTTPS je automatski.

Meni se na sajtu uvek osvežava iz tabele (cene, rasprodato, radno vreme). Ponovni build je potreban samo da bi statički HTML (Google, gosti bez JavaScript-a) video nove cene — dovoljno je jednom nedeljno ili posle većih izmena menija.

## 3. Test pre puštanja (test_mode = TRUE)

| Korak | Očekivano |
|---|---|
| Meni ▸ Grčki Giros ▸ Pošalji test porudžbinu | Email „[TEST] #37 · DOSTAVA…“ stiže na test adresu |
| Na sajtu poručite dostavu (vaš telefon, adresa, 2.000 RSD) | Karta sa brojem #1, red u ORDERS, email za kuhinju sa kusurom |
| Poručite preuzimanje sa terminom | #2, PICKUP, „ZAKAZANO“ u emailu |
| Otvorite `grckigiros.rs/panel/` na tabletu, PIN | Obe porudžbine u koloni „Nove“, zvuk pri novoj |
| Prihvati → U pripremi → Spremno → Preuzeto | Status se menja u tabeli; gost na stranici potvrde vidi status |
| Panel ▸ Rasprodato: isključite jedno jelo | Na meniju piše „Trenutno nema“ |
| Meni ▸ Pošalji dnevni izveštaj za juče | Izveštaj stiže na test adresu |
| Kontakt forma i prijava za posao (sa PDF-om) | Redovi u CONTACT / JOBS, CV u Drive folderu „Grčki Giros — CV prijave“ |

Kada sve prođe: obrišite test redove iz ORDERS/ORDER_ITEMS/CUSTOMERS, **Podesi sledeći broj porudžbine ▸ 1**, i `test_mode` = **FALSE**.

## 4. Posle puštanja

- **Tablet u lokalu** (PDF G30): bilo koji Android tablet sa Chrome-om, `grckigiros.rs/panel/`, „Dodaj na početni ekran“, ekran uvek uključen, zvuk uključen (jedan dodir na ekran posle otvaranja).
- Email kvota: **Grčki Giros ▸ Stanje sistema** pokazuje preostalu dnevnu kvotu, PIN, okidače i poslednji izveštaj.
- Greške: listovi `ERROR_LOG` i `SYSTEM_LOG` (automatski skraćeni na 5.000 redova).

## Poznata ograničenja arhitekture

- Apps Script ne vidi IP adresu ni Origin zaglavlje: zaštita je rate-limit po telefonu i globalno, honeypot, minimalno vreme popunjavanja, idempotencija i serverska validacija svega.
- Hladan start Apps Script-a je 1–3 s; meni se zato prikazuje odmah iz keša/snapshot-a, a slanje porudžbine ima jasan status i bezbedan ponovni pokušaj.
- Okidači imaju ±15 minuta tolerancije (Google).
