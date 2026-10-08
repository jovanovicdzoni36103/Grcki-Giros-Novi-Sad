# Grčki Giros: prezentacioni sajt i digitalni meni

Statički sajt (HTML/CSS/vanilla JS, esbuild) + Google Sheets kao baza + Google Apps Script kao backend. Bez frameworka, bez SQL baze, bez mesečnih troškova.

Od 06.10.2026. sajt je **prezentacioni**: brend, meni sa cenama, lokacija, kontakt, kako radimo i prijava za posao. Online poručivanja nema (nema korpe, checkout-a, zona i cena dostave, zakazivanja ni admin panela). **Jedina forma je prijava za posao**; nijedno polje nije obavezno, CV je opcioni, a prijava stiže na adrese iz SETTINGS `EMAIL_1`…`EMAIL_4` (trenutno samo `EMAIL_1` = nikola.jovanovic.mef@gmail.com).

```powershell
npm install
npm run dev          # build + lokalni server na http://localhost:5190 sa pravim Apps Script kodom u emulatoru
npm test             # unit + Apps Script testovi
npm run test:e2e     # pravi Chrome (8 tokova): početna, meni, prijava za posao sa i bez CV-ja, linkovi, 375–1920 px, tastatura, animacije, performanse
npm run build        # produkcija → dist/ (apiUrl iz site.config.json)
```

Lokalno: poslati emailovi `/__outbox`, stanje tabele `/__state`, nova prazna tabela `/__reset`. Dodavanjem `?__now=2026-10-06T14:00:00%2B02:00` na adresu pomera se vreme backend-a (samo dev build).

## Šta sistem radi

- **Posetilac:** početna (hero, pečat sa logom, akcija, „Kako do girosa“, priča, lokacija, oglas za posao), meni iz tabele sa ilustracijama (bez fotografija hrane) i izborima za giros, O nama, Dostava i preuzimanje sa čestim pitanjima, Kontakt sa mapom na zahtev, prijava za posao, privatnost. Status u zaglavlju („Otvoreno do 01:00“) računa se iz radnog vremena.
- **Lokal:** meni, cene, dostupnost i radno vreme menja u Google tabeli ([uputstvo](docs/UPUTSTVO-ZA-LOKAL.md)). Prijave za posao stižu emailom (CV u prilogu) i upisuju se u list JOBS.
- **Pozadina:** Apps Script vraća meni i podešavanja (`bootstrap`) i prima prijave za posao (`jobs.submit`). Kod za porudžbine i admin panel ostao je u backendu, ali je isključen (`ordering_enabled` = FALSE) i sajt ga ne koristi.

## Struktura

```
data/seed.json                 pravi meni lokala, podešavanja, radno vreme
tests/fixtures/seed.demo.json  nepromenljiv demo meni za Apps Script testove
src/scripts/shared/*.cjs       logika koju dele sajt i Apps Script (radno vreme, cene, validacija, novac)
src/scripts/core|ui|pages/     frontend moduli
src/site/                      build-time šabloni stranica (prerender, SEO, JSON-LD)
src/styles/                    dizajn sistem (tokens → base → components → pages)
src/assets/                    font (subset), SVG ilustracije (art.svg) i ikone, logo, fotografija izloga
backend/apps-script/*.gs       backend; Shared_*.gs i Seed.gs su generisani (tools/gas-sync.mjs)
tools/                         build, dev server, emulator Google servisa, alati za slike
tests/unit|gas|e2e/            testovi
docs/                          analiza, arhitektura, postavljanje, uputstvo za lokal, QA matrica
```

Dokumenti: [postavljanje](docs/SETUP.md) · [uputstvo za lokal](docs/UPUTSTVO-ZA-LOKAL.md) · [QA matrica](docs/QA-CHECKLIST.md) · [arhitektura](docs/ARCHITECTURE.md) i [analiza](docs/ANALYSIS.md) (istorijski, iz vremena online poručivanja)
