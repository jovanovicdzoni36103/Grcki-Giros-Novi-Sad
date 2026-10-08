# Postavljanje u produkciju

Trajanje: ~30 minuta. Troškovi: 0 RSD mesečno (domen se plaća posebno).

```
Posetilac ──► sajt (Cloudflare Pages / Netlify, statički) ──► Apps Script Web App ──► Google Sheets
                                                                   ├─► Gmail (prijave za posao)
                                                                   └─► Google Drive (CV prijave)
```

Od 06.10.2026. sajt je prezentacioni: nema online poručivanja ni admin panela. Backend sajtu daje meni i podešavanja (`bootstrap`) i prima prijave za posao (`jobs.submit`). Kod za porudžbine je i dalje u backendu, isključen sa `ordering_enabled` = FALSE.

## 0. Pre početka

- Google nalog lokala na kome su tabela i sa kog idu emailovi. Besplatan Gmail šalje do 100 primalaca dnevno; jedna prijava za posao troši 1 primaoca po popunjenoj adresi iz `EMAIL_1`…`EMAIL_4` i još 1 za potvrdu kandidatu ako je ostavio email.
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

Pre prvog `clasp push` uključite **Apps Script API** na script.google.com/home/usersettings. `npm run build` generiše `Shared_*.gs` i `Seed.gs`. Web App adresa je `https://script.google.com/macros/s/<deploymentId>/exec`; u editoru (**Deploy ▸ Manage deployments**) proverite *Execute as: Me*, *Who has access: Anyone*.

Trenutna instalacija: tabela `199ZuKxJ1hxpUqTZsDV65E7a484UZ7mVdQqmEdNowthI`, deployment `AKfycbzOPrgRpv8TJ4hiQVoWn850kPJMzVW2R1Sl1z2sukQR-di_dwtyn374gXQBStE91_yeAw` (verzija @6 od 06.10.2026).

U tabeli (meni **Grčki Giros**):

1. **1. Prvo podešavanje**: pravi listove sa podacima iz `data/seed.json` (samo prazne listove, postojeći podaci se ne prepisuju).
2. List **SETTINGS**: `EMAIL_1`…`EMAIL_4` su adrese na koje stižu prijave za posao (prazno polje se preskače). Zatim `email_public`, `phone_*`, `address_*`, `map_url`. `ordering_enabled` = **FALSE**. `test_mode` = FALSE (TRUE šalje sve samo na `test_email_recipient`).
3. **REPORT_CONFIG**: `daily_enabled`, `weekly_enabled`, `monthly_enabled` = FALSE (izveštaji su bili o porudžbinama).
4. Posle izmene menija u `data/seed.json` i novog `clasp push`: **Učitaj meni iz poslednje verzije sajta…** prepisuje CATEGORIES, OPTION_GROUPS, OPTIONS i PRODUCTS.

Kasnije izmene koda: `npm run build`, `npx clasp push --force`, pa `npx clasp update-deployment <deploymentId>` (URL ostaje isti).

Izmene u listovima važe odmah kad ih okidač `onEdit` uhvati, a najkasnije za 60 s (keš).

## 2. Sajt

```powershell
npm install
# site.config.json → "apiUrl": "https://script.google.com/macros/s/…/exec"
npm run build     # → dist/
```

Hosting (besplatno): Cloudflare Pages ili Netlify (`netlify.toml` već postoji). `_headers` (keš i bezbednosna zaglavlja) je u buildu.

Meni, cene, dostupnost i radno vreme sajt čita iz tabele (keš 60 s). Ponovni build treba samo da bi statički HTML za Google i posetioce bez JavaScript-a video nove cene. `npm run sync` povlači živu tabelu u `data/snapshot.json`; tada build koristi nju umesto `data/seed.json`.

## 3. Test pre puštanja

| Korak | Očekivano |
|---|---|
| `/posao/`: prijava sa imenom, telefonom i PDF CV-jem | „Prijava je stigla“, red u JOBS, email na `EMAIL_1` sa CV-jem u prilogu, CV u Drive folderu |
| `/posao/`: prijava bez ijednog polja | „Prijava je stigla. Hvala.“, red u JOBS, email „Prijava za posao: kandidat bez imena“ |
| `/posao/`: telefon `12` ili fajl `.exe` | Poruka greške kod polja, ništa se ne šalje |
| `/meni/` posle izmene cene u PRODUCTS | Nova cena za ≤ 1 min |
| Zaglavlje u radno vreme / nedeljom | „Otvoreno do 01:00“ / „Zatvoreno · otvaramo …“ |

Test prijave posle provere obrišite iz JOBS (i CV iz Drive foldera) ručno.

## Poznata ograničenja

- Apps Script ne vidi IP adresu. Zaštita prijave: honeypot, minimalno vreme popunjavanja, rate-limit po telefonu ili emailu (2 na sat) i globalno (20 na sat), idempotencija, serverska validacija.
- Apps Script odgovara sporo (prijava sa CV-jem ~8 s). Forma pokazuje stanje slanja i bezbedan ponovni pokušaj.
- Okidači imaju ±15 minuta tolerancije (Google).
