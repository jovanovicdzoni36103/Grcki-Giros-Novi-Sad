# Grčki Giros — sajt, digitalni meni i online poručivanje

Statički sajt (HTML/CSS/vanilla JS, esbuild) + Google Sheets kao baza/CRM/analitika + Google Apps Script kao backend. Bez frameworka, bez mesečnih troškova.

```powershell
npm install
npm run dev          # build + lokalni server na http://localhost:5190 sa pravim Apps Script kodom u emulatoru
npm test             # unit + Apps Script testovi (node:test)
npm run test:e2e     # pravi Chrome: dostava, preuzimanje, greške, panel, forme, 375–1920 px, performanse
npm run build        # produkcija → dist/ (apiUrl iz site.config.json)
```

Najlakše: dvoklik na `POKRENI-SAJT.cmd` (instalira zavisnosti ako fale, gradi i otvara `http://localhost:5180`). `dist/index.html` otvoren direktno sa diska radi bez CSS-a, jer se asseti traže na `/assets/...`.

Lokalno: panel `http://localhost:5190/panel/` (PIN `123456`), poslati emailovi `/__outbox`, stanje tabele `/__state`, nova prazna tabela `/__reset`. Na stranici se dodavanjem `?__now=2026-09-27T12:00:00%2B02:00` pomera vreme backend-a (samo dev build).

## Struktura

```
data/seed.json                 jedini izvor demo menija, podešavanja i radnog vremena
src/scripts/shared/*.cjs       logika koju dele sajt i Apps Script (vreme, cene, validacija, novac)
src/scripts/core|ui|pages/     frontend moduli
src/site/                      build-time šabloni stranica (prerender, SEO, JSON-LD)
src/styles/                    dizajn sistem (tokens → base → components → pages)
src/assets/                    font (subset), SVG ilustracije i ikone
backend/apps-script/*.gs       backend; Shared_*.gs i Seed.gs su generisani (tools/gas-sync.mjs)
tools/                         build, dev server, emulator Google servisa, alati za slike i screenshotove
tests/unit|gas|e2e/            testovi
docs/                          analiza, arhitektura, postavljanje, uputstvo za lokal, QA matrica
```

Dokumenti: [analiza](docs/ANALYSIS.md) · [arhitektura](docs/ARCHITECTURE.md) · [postavljanje](docs/SETUP.md) · [uputstvo za lokal](docs/UPUTSTVO-ZA-LOKAL.md) · [QA matrica](docs/QA-CHECKLIST.md)
