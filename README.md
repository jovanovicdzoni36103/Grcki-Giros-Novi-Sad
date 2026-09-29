# Grčki Giros — sajt, digitalni meni i online poručivanje

Statički sajt (HTML/CSS/vanilla JS, esbuild) + Google Sheets kao baza + Google Apps Script kao backend + admin panel za lokal. Bez frameworka, bez SQL baze, bez mesečnih troškova.

```powershell
npm install
npm run dev          # build + lokalni server na http://localhost:5190 sa pravim Apps Script kodom u emulatoru
npm test             # unit + Apps Script testovi (180)
npm run test:e2e     # pravi Chrome (21 tok): kupac, admin, greške, forme, 375–1920 px, pristupačnost, performanse
npm run build        # produkcija → dist/ (apiUrl iz site.config.json)
```

Najlakše: dvoklik na `POKRENI-SAJT.cmd` (instalira zavisnosti ako fale, gradi i otvara `http://localhost:5180`). `dist/index.html` otvoren direktno sa diska radi bez CSS-a, jer se asseti traže na `/assets/...`.

Lokalno:

- admin panel: `http://localhost:5190/admin/` (PIN `123456`)
- poslati emailovi: `/__outbox`
- stanje tabele: `/__state`
- nova prazna tabela: `/__reset`

Na stranici se dodavanjem `?__now=2026-09-23T14:23:00%2B02:00` pomera vreme backend-a (samo dev build).

## Šta sistem radi

- **Kupac:** meni iz tabele, proizvod sa opcijama (svaki komad posebno), korpa, dostava ili preuzimanje, naselje (zona) sa cenom i minimumom od 500 RSD, ŠTO PRE ili termin na 30 min do 7 dana unapred, gotovina sa kusurom, broj porudžbine (#1001…), živi status, ocena posle završetka.
- **Lokal (`/admin/`):** nove porudžbine sa zvukom, trakom i rokom od 5 min, prihvati/odbij, statusi (nova → potvrđena → u pripremi → spremna → završena, ili odbijena), istorija sa pretragom, dnevni pregled, proizvodi (cena, opis, fotografija, dostupnost, redosled), kategorije, dodaci, zone, radno vreme sa pauzom, pauza svih porudžbina/dostave/preuzimanja, procene vremena, feedback, podešavanja i PIN.
- **Pozadina:** Google Sheets (ORDERS, ORDER_ITEMS, PRODUCTS, CATEGORIES, OPTION_GROUPS, OPTIONS, ZONES, HOURS, SETTINGS, FEEDBACK + statistika i logovi), Apps Script (validacija, lock, brojevi, emailovi, izveštaji).

## Struktura

```
data/seed.json                 pravi meni lokala (29.09.2026), podešavanja, radno vreme, zone
tests/fixtures/seed.demo.json  nepromenljiv demo meni na kome rade svi testovi
src/scripts/shared/*.cjs       logika koju dele sajt i Apps Script (vreme i termini, cene, validacija, novac)
src/scripts/core|ui|pages/     frontend moduli (pages/admin.js = admin panel)
src/site/                      build-time šabloni stranica (prerender, SEO, JSON-LD)
src/styles/                    dizajn sistem (tokens → base → components → pages)
src/assets/                    font (subset), SVG ilustracije i ikone
backend/apps-script/*.gs       backend; Shared_*.gs i Seed.gs su generisani (tools/gas-sync.mjs)
tools/                         build, dev server, emulator Google servisa, alati za slike i screenshotove
tests/unit|gas|e2e/            testovi
docs/                          analiza, arhitektura, postavljanje, uputstvo za lokal, QA matrica
```

Dokumenti: [analiza](docs/ANALYSIS.md) · [arhitektura](docs/ARCHITECTURE.md) · [postavljanje](docs/SETUP.md) · [uputstvo za lokal](docs/UPUTSTVO-ZA-LOKAL.md) · [QA matrica](docs/QA-CHECKLIST.md)
