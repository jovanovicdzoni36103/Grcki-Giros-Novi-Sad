# Uputstvo za lokal (Ognjen, Milica)

Sve što se menja bez programera menja se u Google tabeli „Grčki Giros — porudžbine“. Sajt vidi izmenu u roku od jednog minuta.

## Najčešće

| Hoću da… | Gde | Kako |
|---|---|---|
| promenim cenu | list **PRODUCTS**, kolona `price` | upišite broj bez tačke i „RSD“, npr. `650` |
| isključim jelo kad ga nestane | **panel** ▸ Rasprodato, ili PRODUCTS ▸ `available` | skinite kvačicu; vratite je kad ima |
| pauziram porudžbine (gužva, kvar) | **panel** ▸ „Primamo porudžbine“, ili SETTINGS ▸ `ordering_enabled` = FALSE | gosti vide da trenutno ne primamo porudžbine |
| kažem gostima da će čekati duže | **panel** ▸ Gužva +15 / +30 | sva vremena na sajtu se pomere |
| promenim radno vreme | list **HOURS** | vreme pišite kao `09:00`; `closed` = kvačica za neradni dan |
| praznik ili skraćen dan | list **SPECIAL_HOURS** | datum `31.12.2026`, vremena, `active` = kvačica |
| promenim ko dobija porudžbine na email | SETTINGS ▸ `order_email_recipients` | više adresa odvojite zarezom |
| promenim cenu dostave | SETTINGS ▸ `delivery_fee_default` | broj u dinarima |
| pogledam koliko je sajt doneo | list **DASHBOARD** | danas, nedelja, mesec, godina, ukupno od prvog dana |

## Novo jelo

Kopirajte red sličnog jela u **PRODUCTS**, promenite `id` (mala slova, bez razmaka, npr. `giros-fit`), `name`, `description`, `price`, `sort` (redosled u kategoriji). Kolona `groups` određuje izbore (meso, sosovi, salate…), `defaults` šta je već izabrano. Jelo bez izbora (piće, sosevi) ima prazne `groups` i dodaje se jednim dodirom.

Slika: fotografiju (svetla, zbliže, bez tamne pozadine, 800×860 px ili veća) pošaljite osobi koja održava sajt. Ona je stavlja u `src/assets/img/menu/` kao WebP i u kolonu `image` upisuje putanju, npr. `/assets/img/menu/klasik.webp`. Dok je kolona prazna, prikazuje se ilustracija.

## Panel na tabletu (`grckigiros.rs/panel/`)

- Nova porudžbina: zvuk na svakih 15 sekundi dok je ne **Prihvatite**.
- Redosled dugmadi: **Prihvati → U pripremi → Spremno → Predato kuriru / Preuzeto → Isporučeno**.
- **Odbij / Otkaži**: pozovite gosta — broj je na kartici.
- Gost na telefonu vidi svaki korak („Potvrđena“, „U pripremi“, „Na putu“…).

## Brojevi porudžbina

Broj ide od 1 do 100, pa opet od 1. Svaka porudžbina ima i interni ID (npr. `GG-20260923-37-00A4`) koji se nikad ne ponavlja — po njemu se traži u tabeli. Ako treba da brojevi krenu od nekog broja: **Grčki Giros ▸ Podesi sledeći broj porudžbine**.

## Ne dirati

- Nazive kolona (prvi red svakog lista) i listove ORDERS, ORDER_ITEMS, *_STATS, *_LOG — puni ih sistem.
- `timezone` u SETTINGS.
- Kolone `id` postojećih jela (menjaju vezu sa starim porudžbinama u statistici).

## Izveštaji

Stižu sami na email iz REPORT_CONFIG: svaki dan oko 01:00 (prethodni dan), ponedeljkom (prethodna nedelja), prvog u mesecu (prethodni mesec). Prihod u izveštajima je vrednost hrane iz porudžbina koje nisu otkazane; dostava se vodi posebno.
