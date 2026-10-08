# Uputstvo za lokal: Google tabela

Sajt više ne prima porudžbine. Sve što se na sajtu menja (meni, cene, radno vreme, oglas za posao) menja se u Google tabeli **Grcki Giros Tontic**. Izmena se na sajtu vidi za najviše jedan minut.

## Promena cene

List **PRODUCTS**, kolona `price`: upišite novu cenu u dinarima, samo broj (npr. `560`).

## Kad nešto nestane

List **PRODUCTS**, kolona `available`: `FALSE` = na meniju piše „Trenutno nema“, `TRUE` = ponovo dostupno.

## Naziv ili opis jela

List **PRODUCTS**, kolone `name` i `description`. Za piće uvek napišite zapreminu u opisu (npr. `Limenka / 0,33 l`), a ne u nazivu. Ne koristite crtu „—“ u tekstu.

## Izbori za giros (meso, premazi, salate, začini)

List **OPTIONS**. Na meniju se prikazuju ispod girosa, pod „Birate sami, bez doplate“. `available` = `FALSE` sklanja izbor.

## Radno vreme

List **HOURS** (redovno) i **SPECIAL_HOURS** (praznici, godišnji odmor). Status „Otvoreno do …“ u zaglavlju sajta računa se odatle.

## Oglas za posao

List **SETTINGS**: `job_active` = `TRUE` prikazuje oglas i formu, `FALSE` prikazuje „Trenutno ne tražimo nove ljude“. `job_title` je naziv pozicije.

## Prijave za posao

Stižu emailom na adrese iz SETTINGS `EMAIL_1`…`EMAIL_4` (prazno polje se preskače), sa CV-jem u prilogu kada ga kandidat pošalje. Sve prijave su i u listu **JOBS**, a CV fajlovi u Google Drive folderu lokala. Nijedno polje u formi nije obavezno, pa prijava može da stigne i bez imena ili kontakta.

## Kontakt email na sajtu

SETTINGS `email_public`. Trenutno nikola.jovanovic.mef@gmail.com, dok se ne dogovori druga adresa.

## Vraćanje menija na verziju sa sajta

Meni **Grčki Giros ▸ Učitaj meni iz poslednje verzije sajta…** zamenjuje listove CATEGORIES, OPTION_GROUPS, OPTIONS i PRODUCTS menijem koji je poslednji put objavljen sa sajtom. Ručne izmene u ta četiri lista se pri tome gube; ostali listovi se ne diraju.

## Ne dirati

Nazive listova i prvi red (zaglavlja kolona). Ključeve u koloni `key` (SETTINGS, REPORT_CONFIG) ne menjati, samo vrednosti. `ordering_enabled` ostaje `FALSE`.
