// GENERATED from data/seed.json by tools/gas-sync.mjs — do not edit here.
var SEED = {
 "settings": [
  {
   "key": "business_name",
   "value": "Grčki Giros",
   "note": "Naziv na sajtu, u emailovima i izveštajima"
  },
  {
   "key": "location_id",
   "value": "GG-01",
   "note": "Interna oznaka lokala (priprema za eventualni drugi lokal)"
  },
  {
   "key": "address_street",
   "value": "Dimitrija Tucovića 3",
   "note": "Adresa lokala"
  },
  {
   "key": "address_city",
   "value": "Novi Sad",
   "note": ""
  },
  {
   "key": "postal_code",
   "value": "21000",
   "note": ""
  },
  {
   "key": "phone_display",
   "value": "064 227 4334",
   "note": "Telefon kako se prikazuje"
  },
  {
   "key": "phone_e164",
   "value": "+381642274334",
   "note": "Telefon za tel: link"
  },
  {
   "key": "email_public",
   "value": "milica.tontic70@gmail.com",
   "note": "Javni email (strana Kontakt)"
  },
  {
   "key": "instagram_url",
   "value": "https://www.instagram.com/friends_and_foodns/",
   "note": ""
  },
  {
   "key": "site_url",
   "value": "https://grckigiros.rs",
   "note": "Adresa sajta (linkovi u emailovima)"
  },
  {
   "key": "map_query",
   "value": "Dimitrija Tucovića 3, Novi Sad",
   "note": "Upit za Google Maps"
  },
  {
   "key": "timezone",
   "value": "Europe/Belgrade",
   "note": "Ne menjati"
  },
  {
   "key": "ordering_enabled",
   "value": "TRUE",
   "note": "FALSE = pauza, sajt ne prima porudžbine (menja se iz admin panela)"
  },
  {
   "key": "pause_message",
   "value": "Trenutno ne primamo porudžbine preko sajta.",
   "note": "Poruka gostima tokom pauze"
  },
  {
   "key": "delivery_enabled",
   "value": "TRUE",
   "note": "FALSE = dostava privremeno isključena, preuzimanje radi (admin panel)"
  },
  {
   "key": "pickup_enabled",
   "value": "TRUE",
   "note": "FALSE = preuzimanje privremeno isključeno, dostava radi (admin panel)"
  },
  {
   "key": "delivery_eta_min",
   "value": "45",
   "note": "Procena dostave, najkraće (min)"
  },
  {
   "key": "delivery_eta_max",
   "value": "60",
   "note": "Procena dostave, najduže (min). PDF: ~60"
  },
  {
   "key": "pickup_eta_min",
   "value": "15",
   "note": "Procena preuzimanja, najkraće (min). PDF: 15"
  },
  {
   "key": "pickup_eta_max",
   "value": "30",
   "note": "Procena preuzimanja, najduže (min). PDF: do 30"
  },
  {
   "key": "extra_wait_min",
   "value": "0",
   "note": "Gužva: dodatni minuti na sve procene (admin panel)"
  },
  {
   "key": "asap_cutoff_min",
   "value": "15",
   "note": "Poslednja ŠTO PRE porudžbina = zatvaranje minus ovoliko minuta"
  },
  {
   "key": "slot_first_offset_min",
   "value": "30",
   "note": "Zakazani termin najranije za ovoliko minuta (i nikad pre najduže procene)"
  },
  {
   "key": "slot_interval_min",
   "value": "30",
   "note": "Razmak između termina (30 = 18:00, 18:30, 19:00…)"
  },
  {
   "key": "slot_round_min",
   "value": "30",
   "note": "Termini počinju na punih ovoliko minuta"
  },
  {
   "key": "preorder_days",
   "value": "7",
   "note": "Zakazivanje najviše ovoliko dana unapred"
  },
  {
   "key": "business_day_rollover_hour",
   "value": "6",
   "note": "Posle ovog sata počinje novi poslovni dan (radi se do 01:00)"
  },
  {
   "key": "delivery_fee_mode",
   "value": "fixed",
   "note": "fixed = cena dostave ulazi u ukupno; agency = naplaćuje agencija po svom cenovniku"
  },
  {
   "key": "delivery_fee_default",
   "value": "250",
   "note": "DEMO — cena dostave kad zone nisu uključene (čeka cenu agencije)"
  },
  {
   "key": "zones_enabled",
   "value": "TRUE",
   "note": "TRUE = gost bira naselje iz ZONES (cena dostave i minimum po zoni)"
  },
  {
   "key": "free_delivery_threshold",
   "value": "0",
   "note": "0 = nema besplatne dostave (PDF)"
  },
  {
   "key": "min_order_delivery",
   "value": "500",
   "note": "Minimalna porudžbina za dostavu kad zona nema svoj minimum"
  },
  {
   "key": "min_order_pickup",
   "value": "0",
   "note": ""
  },
  {
   "key": "order_number_start",
   "value": "1001",
   "note": "Prva porudžbina dobija ovaj broj, posle raste (#1001, #1002…)"
  },
  {
   "key": "accept_timeout_min",
   "value": "5",
   "note": "Za koliko minuta lokal treba da prihvati ili odbije novu porudžbinu"
  },
  {
   "key": "order_email_recipients",
   "value": "milica.tontic70@gmail.com",
   "note": "Ko dobija kartu porudžbine (zarezom odvojeno)"
  },
  {
   "key": "customer_confirmation_enabled",
   "value": "TRUE",
   "note": "Potvrda kupcu ako je uneo email"
  },
  {
   "key": "customer_status_emails",
   "value": "TRUE",
   "note": "Kupac sa emailom dobija: potvrđena, odbijena, spremna za preuzimanje"
  },
  {
   "key": "contact_email_recipients",
   "value": "milica.tontic70@gmail.com",
   "note": "Poruke sa strane Kontakt"
  },
  {
   "key": "jobs_email_recipients",
   "value": "svetislavtontic@gmail.com, milica.tontic70@gmail.com",
   "note": "Prijave za posao (PDF G40)"
  },
  {
   "key": "test_mode",
   "value": "TRUE",
   "note": "TRUE = SVI emailovi idu samo na test_email_recipient, sa [TEST] u naslovu"
  },
  {
   "key": "test_email_recipient",
   "value": "",
   "note": "Prazno = vlasnik skripte"
  },
  {
   "key": "rate_limit_phone_count",
   "value": "3",
   "note": "Najviše porudžbina sa istog telefona…"
  },
  {
   "key": "rate_limit_phone_window_min",
   "value": "10",
   "note": "…u ovoliko minuta"
  },
  {
   "key": "rate_limit_global_per_min",
   "value": "20",
   "note": "Najviše porudžbina u minuti ukupno"
  },
  {
   "key": "max_lines_per_order",
   "value": "30",
   "note": ""
  },
  {
   "key": "max_qty_per_line",
   "value": "20",
   "note": ""
  },
  {
   "key": "cash_max_over_total",
   "value": "20000",
   "note": "Gornja granica za 'Plaćam sa' iznad ukupnog iznosa"
  },
  {
   "key": "revenue_includes_delivery",
   "value": "FALSE",
   "note": "FALSE = prihod sajta je samo hrana (dostavu naplaćuje agencija)"
  },
  {
   "key": "job_active",
   "value": "TRUE",
   "note": "Da li je oglas za posao aktivan"
  },
  {
   "key": "job_title",
   "value": "Prodavac-kuvar",
   "note": ""
  },
  {
   "key": "job_salary",
   "value": "",
   "note": "Raspon plate (prazno = ne prikazuje se)"
  },
  {
   "key": "panel_poll_seconds",
   "value": "10",
   "note": "Koliko često admin panel proverava nove porudžbine (sekunde)"
  },
  {
   "key": "image_url_template",
   "value": "https://lh3.googleusercontent.com/d/{id}=w900",
   "note": "Adresa slike iz Google Drive-a ({id} = ID fajla). Ne menjati"
  }
 ],
 "hours": [
  {
   "dow": 1,
   "day": "Ponedeljak",
   "open": "09:00",
   "close": "01:00",
   "delivery_open": "10:00",
   "delivery_close": "00:00",
   "closed": false,
   "break_start": "",
   "break_end": ""
  },
  {
   "dow": 2,
   "day": "Utorak",
   "open": "09:00",
   "close": "01:00",
   "delivery_open": "10:00",
   "delivery_close": "00:00",
   "closed": false,
   "break_start": "",
   "break_end": ""
  },
  {
   "dow": 3,
   "day": "Sreda",
   "open": "09:00",
   "close": "01:00",
   "delivery_open": "10:00",
   "delivery_close": "00:00",
   "closed": false,
   "break_start": "",
   "break_end": ""
  },
  {
   "dow": 4,
   "day": "Četvrtak",
   "open": "09:00",
   "close": "01:00",
   "delivery_open": "10:00",
   "delivery_close": "00:00",
   "closed": false,
   "break_start": "",
   "break_end": ""
  },
  {
   "dow": 5,
   "day": "Petak",
   "open": "09:00",
   "close": "01:00",
   "delivery_open": "10:00",
   "delivery_close": "00:00",
   "closed": false,
   "break_start": "",
   "break_end": ""
  },
  {
   "dow": 6,
   "day": "Subota",
   "open": "09:00",
   "close": "01:00",
   "delivery_open": "10:00",
   "delivery_close": "00:00",
   "closed": false,
   "break_start": "",
   "break_end": ""
  },
  {
   "dow": 7,
   "day": "Nedelja",
   "open": "",
   "close": "",
   "delivery_open": "",
   "delivery_close": "",
   "closed": true,
   "break_start": "",
   "break_end": ""
  }
 ],
 "specialHours": [
  {
   "date": "2027-01-01",
   "label": "Nova godina",
   "open": "",
   "close": "",
   "delivery_open": "",
   "delivery_close": "",
   "closed": true,
   "active": false,
   "note": "PRIMER — uključiti (active=TRUE) ili obrisati"
  },
  {
   "date": "2026-12-31",
   "label": "Doček",
   "open": "09:00",
   "close": "18:00",
   "delivery_open": "10:00",
   "delivery_close": "17:00",
   "closed": false,
   "active": false,
   "note": "PRIMER — skraćeno radno vreme"
  }
 ],
 "zones": [
  {
   "id": "ns-grad",
   "name": "Novi Sad — grad",
   "areas": "Centar, Stari grad, Rotkvarija, Podbara, Salajka, Liman 1, Liman 2, Liman 3, Liman 4, Grbavica, Adamovićevo naselje, Detelinara, Novo naselje, Bistrica, Telep, Banatić, Sajmište",
   "fee": 250,
   "min_order": 500,
   "active": true,
   "sort": 1,
   "note": "DEMO — potvrditi sa agencijom"
  },
  {
   "id": "ns-okolina",
   "name": "Petrovaradin i Sremska Kamenica",
   "areas": "Petrovaradin, Sremska Kamenica",
   "fee": 350,
   "min_order": 500,
   "active": true,
   "sort": 2,
   "note": "DEMO — potvrditi sa agencijom"
  }
 ],
 "reportConfig": [
  {
   "key": "daily_enabled",
   "value": "TRUE",
   "note": "Dnevni izveštaj za prethodni radni dan"
  },
  {
   "key": "daily_hour",
   "value": "1",
   "note": "Sat slanja (Apps Script tolerancija ±15 min)"
  },
  {
   "key": "weekly_enabled",
   "value": "TRUE",
   "note": ""
  },
  {
   "key": "weekly_day",
   "value": "MONDAY",
   "note": "MONDAY … SUNDAY"
  },
  {
   "key": "weekly_hour",
   "value": "2",
   "note": ""
  },
  {
   "key": "monthly_enabled",
   "value": "TRUE",
   "note": ""
  },
  {
   "key": "monthly_day",
   "value": "1",
   "note": "Dan u mesecu (1–28)"
  },
  {
   "key": "monthly_hour",
   "value": "3",
   "note": ""
  },
  {
   "key": "report_recipients",
   "value": "milica.tontic70@gmail.com",
   "note": "Primaoci izveštaja (zarezom odvojeno)"
  },
  {
   "key": "dashboard_refresh_min",
   "value": "10",
   "note": "5, 10, 15 ili 30"
  }
 ],
 "catalog": {
  "categories": [
   {
    "id": "giros",
    "name": "Giros",
    "description": "U piti koja stiže iz Atine. Pomfrit ide unutra, osim ako ne kažete drugačije.",
    "sort": 1,
    "active": true
   },
   {
    "id": "porcije",
    "name": "Porcije",
    "description": "Isto meso, ali na tanjiru i sa viljuškom.",
    "sort": 2,
    "active": true
   },
   {
    "id": "paketi",
    "name": "Paketi",
    "description": "Giros sa društvom. Povoljnije nego kad se uzima pojedinačno.",
    "sort": 3,
    "active": true
   },
   {
    "id": "prilozi",
    "name": "Prilozi",
    "description": "Pomfrit se prži kad ga poručiš.",
    "sort": 4,
    "active": true
   },
   {
    "id": "salate",
    "name": "Salate",
    "description": "Sveže seckano, bez preliva koji prekrije ukus.",
    "sort": 5,
    "active": true
   },
   {
    "id": "sosovi",
    "name": "Sosovi",
    "description": "Za umakanje, za pomfrit, za sutra.",
    "sort": 6,
    "active": true
   },
   {
    "id": "pice",
    "name": "Piće",
    "description": "Hladno.",
    "sort": 7,
    "active": true
   }
  ],
  "groups": [
   {
    "id": "meso",
    "name": "Meso",
    "type": "single",
    "required": true,
    "min": 1,
    "max": 1,
    "display": "cards",
    "hint": "Seče se sa ražnja kad stigne porudžbina.",
    "sort": 1
   },
   {
    "id": "pita",
    "name": "Pita",
    "type": "single",
    "required": true,
    "min": 1,
    "max": 1,
    "display": "info",
    "hint": "Stiže iz Atine.",
    "sort": 2
   },
   {
    "id": "sosovi",
    "name": "Sosovi",
    "type": "multi",
    "required": false,
    "min": 0,
    "max": 0,
    "display": "chips",
    "hint": "Bez doplate, koliko god želite.",
    "sort": 3
   },
   {
    "id": "salate",
    "name": "Salate",
    "type": "multi",
    "required": false,
    "min": 0,
    "max": 0,
    "display": "chips",
    "hint": "Bez doplate.",
    "sort": 4
   },
   {
    "id": "zacini",
    "name": "Začini",
    "type": "multi",
    "required": false,
    "min": 0,
    "max": 0,
    "display": "chips",
    "hint": "",
    "sort": 5
   },
   {
    "id": "pomfrit-u-piti",
    "name": "Pomfrit u piti",
    "type": "multi",
    "required": false,
    "min": 0,
    "max": 1,
    "display": "toggle",
    "hint": "Grčki način. Isključite ako ga ne želite unutra.",
    "sort": 6
   },
   {
    "id": "dodaci",
    "name": "Dodaci",
    "type": "multi",
    "required": false,
    "min": 0,
    "max": 0,
    "display": "chips",
    "hint": "Uz doplatu.",
    "sort": 7
   },
   {
    "id": "sok",
    "name": "Sok 0.33 l",
    "type": "single",
    "required": true,
    "min": 1,
    "max": 1,
    "display": "chips",
    "hint": "",
    "sort": 8
   },
   {
    "id": "duo-meso-1",
    "name": "Prvi giros — meso",
    "type": "single",
    "required": true,
    "min": 1,
    "max": 1,
    "display": "cards",
    "hint": "",
    "sort": 1
   },
   {
    "id": "duo-meso-2",
    "name": "Drugi giros — meso",
    "type": "single",
    "required": true,
    "min": 1,
    "max": 1,
    "display": "cards",
    "hint": "",
    "sort": 2
   },
   {
    "id": "duo-sok-1",
    "name": "Prvi sok",
    "type": "single",
    "required": true,
    "min": 1,
    "max": 1,
    "display": "chips",
    "hint": "",
    "sort": 8
   },
   {
    "id": "duo-sok-2",
    "name": "Drugi sok",
    "type": "single",
    "required": true,
    "min": 1,
    "max": 1,
    "display": "chips",
    "hint": "",
    "sort": 9
   },
   {
    "id": "fam-meso",
    "name": "Meso za četiri girosa",
    "type": "single",
    "required": true,
    "min": 1,
    "max": 1,
    "display": "cards",
    "hint": "",
    "sort": 1
   },
   {
    "id": "fam-sok",
    "name": "Četiri soka",
    "type": "single",
    "required": true,
    "min": 1,
    "max": 1,
    "display": "chips",
    "hint": "",
    "sort": 8
   }
  ],
  "options": [
   {
    "id": "meso-pilece",
    "groupId": "meso",
    "name": "Pileće",
    "price": 0,
    "sort": 1,
    "available": true
   },
   {
    "id": "meso-svinjsko",
    "groupId": "meso",
    "name": "Svinjsko",
    "price": 0,
    "sort": 2,
    "available": true
   },
   {
    "id": "meso-mesano",
    "groupId": "meso",
    "name": "Mešano",
    "price": 0,
    "sort": 3,
    "available": true
   },
   {
    "id": "pita-atina",
    "groupId": "pita",
    "name": "Pita iz Atine",
    "price": 0,
    "sort": 1,
    "available": true
   },
   {
    "id": "sos-tzatziki",
    "groupId": "sosovi",
    "name": "Tzatziki",
    "price": 0,
    "sort": 1,
    "available": true
   },
   {
    "id": "sos-pavlaka",
    "groupId": "sosovi",
    "name": "Pavlaka",
    "price": 0,
    "sort": 2,
    "available": true
   },
   {
    "id": "sos-urnebes",
    "groupId": "sosovi",
    "name": "Urnebes",
    "price": 0,
    "sort": 3,
    "available": true
   },
   {
    "id": "sos-tirokafteri",
    "groupId": "sosovi",
    "name": "Tirokafteri",
    "price": 0,
    "sort": 4,
    "available": true
   },
   {
    "id": "sos-kecap",
    "groupId": "sosovi",
    "name": "Kečap",
    "price": 0,
    "sort": 5,
    "available": true
   },
   {
    "id": "sos-majonez",
    "groupId": "sosovi",
    "name": "Majonez",
    "price": 0,
    "sort": 6,
    "available": true
   },
   {
    "id": "sos-senf",
    "groupId": "sosovi",
    "name": "Senf",
    "price": 0,
    "sort": 7,
    "available": true
   },
   {
    "id": "sal-paradajz",
    "groupId": "salate",
    "name": "Paradajz",
    "price": 0,
    "sort": 1,
    "available": true
   },
   {
    "id": "sal-krastavac",
    "groupId": "salate",
    "name": "Krastavac",
    "price": 0,
    "sort": 2,
    "available": true
   },
   {
    "id": "sal-luk",
    "groupId": "salate",
    "name": "Ljubičasti luk",
    "price": 0,
    "sort": 3,
    "available": true
   },
   {
    "id": "sal-zelena",
    "groupId": "salate",
    "name": "Zelena salata",
    "price": 0,
    "sort": 4,
    "available": true
   },
   {
    "id": "sal-mix",
    "groupId": "salate",
    "name": "Mix salata",
    "price": 0,
    "sort": 5,
    "available": true
   },
   {
    "id": "sal-kupus",
    "groupId": "salate",
    "name": "Kupus",
    "price": 0,
    "sort": 6,
    "available": true
   },
   {
    "id": "sal-lj-kupus",
    "groupId": "salate",
    "name": "Ljubičasti kupus",
    "price": 0,
    "sort": 7,
    "available": true
   },
   {
    "id": "zac-origano",
    "groupId": "zacini",
    "name": "Origano",
    "price": 0,
    "sort": 1,
    "available": true
   },
   {
    "id": "zac-so",
    "groupId": "zacini",
    "name": "Morska so",
    "price": 0,
    "sort": 2,
    "available": true
   },
   {
    "id": "zac-biber",
    "groupId": "zacini",
    "name": "Biber",
    "price": 0,
    "sort": 3,
    "available": true
   },
   {
    "id": "zac-paprika",
    "groupId": "zacini",
    "name": "Tucana ljuta paprika",
    "price": 0,
    "sort": 4,
    "available": true
   },
   {
    "id": "pup-da",
    "groupId": "pomfrit-u-piti",
    "name": "Pomfrit u piti",
    "price": 0,
    "sort": 1,
    "available": true
   },
   {
    "id": "dod-meso",
    "groupId": "dodaci",
    "name": "Extra meso",
    "price": 300,
    "sort": 1,
    "available": true
   },
   {
    "id": "sok-cola",
    "groupId": "sok",
    "name": "Coca-Cola",
    "price": 0,
    "sort": 1,
    "available": true
   },
   {
    "id": "sok-zero",
    "groupId": "sok",
    "name": "Coca-Cola Zero",
    "price": 0,
    "sort": 2,
    "available": true
   },
   {
    "id": "sok-fanta",
    "groupId": "sok",
    "name": "Fanta",
    "price": 0,
    "sort": 3,
    "available": true
   },
   {
    "id": "sok-sprite",
    "groupId": "sok",
    "name": "Sprite",
    "price": 0,
    "sort": 4,
    "available": true
   },
   {
    "id": "d1-pilece",
    "groupId": "duo-meso-1",
    "name": "Pileće",
    "price": 0,
    "sort": 1,
    "available": true
   },
   {
    "id": "d1-svinjsko",
    "groupId": "duo-meso-1",
    "name": "Svinjsko",
    "price": 0,
    "sort": 2,
    "available": true
   },
   {
    "id": "d1-mesano",
    "groupId": "duo-meso-1",
    "name": "Mešano",
    "price": 0,
    "sort": 3,
    "available": true
   },
   {
    "id": "d2-pilece",
    "groupId": "duo-meso-2",
    "name": "Pileće",
    "price": 0,
    "sort": 1,
    "available": true
   },
   {
    "id": "d2-svinjsko",
    "groupId": "duo-meso-2",
    "name": "Svinjsko",
    "price": 0,
    "sort": 2,
    "available": true
   },
   {
    "id": "d2-mesano",
    "groupId": "duo-meso-2",
    "name": "Mešano",
    "price": 0,
    "sort": 3,
    "available": true
   },
   {
    "id": "ds1-cola",
    "groupId": "duo-sok-1",
    "name": "Coca-Cola",
    "price": 0,
    "sort": 1,
    "available": true
   },
   {
    "id": "ds1-zero",
    "groupId": "duo-sok-1",
    "name": "Coca-Cola Zero",
    "price": 0,
    "sort": 2,
    "available": true
   },
   {
    "id": "ds1-fanta",
    "groupId": "duo-sok-1",
    "name": "Fanta",
    "price": 0,
    "sort": 3,
    "available": true
   },
   {
    "id": "ds1-sprite",
    "groupId": "duo-sok-1",
    "name": "Sprite",
    "price": 0,
    "sort": 4,
    "available": true
   },
   {
    "id": "ds2-cola",
    "groupId": "duo-sok-2",
    "name": "Coca-Cola",
    "price": 0,
    "sort": 1,
    "available": true
   },
   {
    "id": "ds2-zero",
    "groupId": "duo-sok-2",
    "name": "Coca-Cola Zero",
    "price": 0,
    "sort": 2,
    "available": true
   },
   {
    "id": "ds2-fanta",
    "groupId": "duo-sok-2",
    "name": "Fanta",
    "price": 0,
    "sort": 3,
    "available": true
   },
   {
    "id": "ds2-sprite",
    "groupId": "duo-sok-2",
    "name": "Sprite",
    "price": 0,
    "sort": 4,
    "available": true
   },
   {
    "id": "fam-mix",
    "groupId": "fam-meso",
    "name": "2 pileća + 2 svinjska",
    "price": 0,
    "sort": 1,
    "available": true
   },
   {
    "id": "fam-pilece",
    "groupId": "fam-meso",
    "name": "4 × pileće",
    "price": 0,
    "sort": 2,
    "available": true
   },
   {
    "id": "fam-svinjsko",
    "groupId": "fam-meso",
    "name": "4 × svinjsko",
    "price": 0,
    "sort": 3,
    "available": true
   },
   {
    "id": "fam-mesano",
    "groupId": "fam-meso",
    "name": "4 × mešano",
    "price": 0,
    "sort": 4,
    "available": true
   },
   {
    "id": "fs-cola",
    "groupId": "fam-sok",
    "name": "4 × Coca-Cola",
    "price": 0,
    "sort": 1,
    "available": true
   },
   {
    "id": "fs-zero",
    "groupId": "fam-sok",
    "name": "4 × Coca-Cola Zero",
    "price": 0,
    "sort": 2,
    "available": true
   },
   {
    "id": "fs-mix",
    "groupId": "fam-sok",
    "name": "2 Coca-Cola + 2 Fanta",
    "price": 0,
    "sort": 3,
    "available": true
   }
  ],
  "products": [
   {
    "id": "klasik",
    "categoryId": "giros",
    "name": "Klasik",
    "description": "Pileće meso, tzatziki, paradajz, ljubičasti luk i pomfrit u piti. Onaj koji svi prvo probaju.",
    "price": 620,
    "comparePrice": 0,
    "art": "wrap",
    "image": "",
    "tags": [
     "popular",
     "recommended"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "meso",
     "pita",
     "sosovi",
     "salate",
     "zacini",
     "pomfrit-u-piti",
     "dodaci"
    ],
    "defaults": [
     "meso-pilece",
     "pita-atina",
     "sos-tzatziki",
     "sal-paradajz",
     "sal-luk",
     "zac-origano",
     "pup-da"
    ],
    "pairs": [
     "coca-cola",
     "tzatziki-100",
     "pomfrit-mali"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 1,
    "demo": true
   },
   {
    "id": "ljutko",
    "categoryId": "giros",
    "name": "Ljutko",
    "description": "Svinjsko meso, urnebes, tirokafteri, ljubičasti luk i tucana ljuta paprika. Ljut, ali pošteno.",
    "price": 640,
    "comparePrice": 0,
    "art": "wrap-spicy",
    "image": "",
    "tags": [
     "spicy",
     "popular"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "meso",
     "pita",
     "sosovi",
     "salate",
     "zacini",
     "pomfrit-u-piti",
     "dodaci"
    ],
    "defaults": [
     "meso-svinjsko",
     "pita-atina",
     "sos-urnebes",
     "sos-tirokafteri",
     "sal-luk",
     "zac-paprika",
     "pup-da"
    ],
    "pairs": [
     "coca-cola-zero",
     "tirokafteri-100",
     "voda"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 2,
    "demo": true
   },
   {
    "id": "atina",
    "categoryId": "giros",
    "name": "Atina",
    "description": "Mešano meso, tzatziki, paradajz, krastavac, origano i morska so. Onako kako se jede u Atini.",
    "price": 660,
    "comparePrice": 0,
    "art": "wrap-atina",
    "image": "",
    "tags": [
     "recommended",
     "new"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "meso",
     "pita",
     "sosovi",
     "salate",
     "zacini",
     "pomfrit-u-piti",
     "dodaci"
    ],
    "defaults": [
     "meso-mesano",
     "pita-atina",
     "sos-tzatziki",
     "sal-paradajz",
     "sal-krastavac",
     "zac-origano",
     "zac-so",
     "pup-da"
    ],
    "pairs": [
     "tzatziki-100",
     "fanta",
     "mix-salata"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 3,
    "demo": true
   },
   {
    "id": "slozi-svoj",
    "categoryId": "giros",
    "name": "Složi svoj",
    "description": "Meso, sosovi, salate i začini po vašem izboru. Mi samo pazimo da se pita zatvori.",
    "price": 620,
    "comparePrice": 0,
    "art": "wrap-custom",
    "image": "",
    "tags": [],
    "badge": "Po tvom",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "meso",
     "pita",
     "sosovi",
     "salate",
     "zacini",
     "pomfrit-u-piti",
     "dodaci"
    ],
    "defaults": [
     "pita-atina",
     "pup-da"
    ],
    "pairs": [
     "coca-cola",
     "pomfrit-mali",
     "tzatziki-100"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 4,
    "demo": true
   },
   {
    "id": "giros-max",
    "categoryId": "giros",
    "name": "Giros MAX",
    "description": "Dupla porcija mesa u istoj piti. Za dane kad je obična glad premala.",
    "price": 820,
    "comparePrice": 0,
    "art": "wrap-max",
    "image": "",
    "tags": [
     "popular"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "meso",
     "pita",
     "sosovi",
     "salate",
     "zacini",
     "pomfrit-u-piti",
     "dodaci"
    ],
    "defaults": [
     "meso-pilece",
     "pita-atina",
     "sos-tzatziki",
     "sal-paradajz",
     "sal-luk",
     "pup-da"
    ],
    "pairs": [
     "coca-cola",
     "pomfrit-veliki"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 5,
    "demo": true
   },
   {
    "id": "vege-pita",
    "categoryId": "giros",
    "name": "Vege pita",
    "description": "Pita iz Atine, pomfrit, tzatziki, paradajz, krastavac i zelena salata. Bez mesa, bez kompromisa.",
    "price": 390,
    "comparePrice": 0,
    "art": "wrap-veg",
    "image": "",
    "tags": [
     "vegetarian"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "pita",
     "sosovi",
     "salate",
     "zacini",
     "pomfrit-u-piti"
    ],
    "defaults": [
     "pita-atina",
     "sos-tzatziki",
     "sal-paradajz",
     "sal-krastavac",
     "sal-zelena",
     "pup-da"
    ],
    "pairs": [
     "mix-salata",
     "sprite"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 6,
    "demo": true
   },
   {
    "id": "giros-porcija",
    "categoryId": "porcije",
    "name": "Giros porcija",
    "description": "Meso, pomfrit, pita, tzatziki i salata na tanjiru. Porcija za ozbiljnu glad.",
    "price": 990,
    "comparePrice": 0,
    "art": "plate",
    "image": "",
    "tags": [
     "popular"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "meso",
     "sosovi",
     "salate",
     "dodaci"
    ],
    "defaults": [
     "meso-pilece",
     "sos-tzatziki",
     "sal-paradajz",
     "sal-krastavac",
     "sal-luk"
    ],
    "pairs": [
     "tzatziki-100",
     "coca-cola"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 1,
    "demo": true
   },
   {
    "id": "giros-box",
    "categoryId": "porcije",
    "name": "Giros box",
    "description": "Meso i pomfrit u kutiji, sos po izboru. Bez pite, bez čekanja.",
    "price": 740,
    "comparePrice": 0,
    "art": "box",
    "image": "",
    "tags": [],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "meso",
     "sosovi",
     "zacini",
     "dodaci"
    ],
    "defaults": [
     "meso-pilece",
     "sos-tzatziki",
     "zac-origano"
    ],
    "pairs": [
     "coca-cola",
     "tzatziki-100"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 2,
    "demo": true
   },
   {
    "id": "giros-sok",
    "categoryId": "paketi",
    "name": "Giros + sok",
    "description": "Giros složen po vašem ukusu i sok 0.33. Najbrža odluka dana.",
    "price": 720,
    "comparePrice": 820,
    "art": "bundle-1",
    "image": "",
    "tags": [
     "promo",
     "value"
    ],
    "badge": "Akcija",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "meso",
     "pita",
     "sosovi",
     "salate",
     "zacini",
     "pomfrit-u-piti",
     "sok"
    ],
    "defaults": [
     "pita-atina",
     "sos-tzatziki",
     "sal-paradajz",
     "sal-luk",
     "pup-da",
     "sok-cola"
    ],
    "pairs": [
     "pomfrit-mali"
    ],
    "bundleHint": "cat:giros+cat:pice",
    "includes": "1 giros · sok 0.33",
    "kind": "bundle",
    "sort": 1,
    "demo": true
   },
   {
    "id": "giros-duo",
    "categoryId": "paketi",
    "name": "Giros Duo",
    "description": "Dva girosa, veliki pomfrit i dva soka. Za dvoje, ili za jednog vrlo gladnog.",
    "price": 1690,
    "comparePrice": 1930,
    "art": "bundle-2",
    "image": "",
    "tags": [
     "value"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "duo-meso-1",
     "duo-meso-2",
     "pita",
     "sosovi",
     "salate",
     "pomfrit-u-piti",
     "duo-sok-1",
     "duo-sok-2"
    ],
    "defaults": [
     "pita-atina",
     "sos-tzatziki",
     "sal-paradajz",
     "sal-luk",
     "pup-da",
     "ds1-cola",
     "ds2-cola"
    ],
    "pairs": [
     "tzatziki-300"
    ],
    "bundleHint": "",
    "includes": "2 girosa · veliki pomfrit · 2 soka 0.33",
    "kind": "bundle",
    "sort": 2,
    "demo": true
   },
   {
    "id": "porodicni-box",
    "categoryId": "paketi",
    "name": "Porodični box",
    "description": "Četiri girosa, dva velika pomfrita i četiri soka. Večera za celu ekipu, bez pranja sudova.",
    "price": 3290,
    "comparePrice": 3860,
    "art": "bundle-4",
    "image": "",
    "tags": [
     "family",
     "value"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "fam-meso",
     "pita",
     "sosovi",
     "salate",
     "pomfrit-u-piti",
     "fam-sok"
    ],
    "defaults": [
     "fam-mix",
     "pita-atina",
     "sos-tzatziki",
     "sal-paradajz",
     "sal-luk",
     "pup-da",
     "fs-cola"
    ],
    "pairs": [
     "tzatziki-300",
     "mix-salata"
    ],
    "bundleHint": "",
    "includes": "4 girosa · 2 velika pomfrita · 4 soka 0.33",
    "kind": "bundle",
    "sort": 3,
    "demo": true
   },
   {
    "id": "pomfrit-mali",
    "categoryId": "prilozi",
    "name": "Pomfrit mali",
    "description": "Prži se kad ga poručiš, soli se morskom solju.",
    "price": 230,
    "comparePrice": 0,
    "art": "fries",
    "image": "",
    "tags": [
     "vegetarian"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [],
    "defaults": [],
    "pairs": [
     "tzatziki-100",
     "urnebes-100"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 1,
    "demo": true
   },
   {
    "id": "pomfrit-veliki",
    "categoryId": "prilozi",
    "name": "Pomfrit veliki",
    "description": "Isti pomfrit, više za deljenje.",
    "price": 290,
    "comparePrice": 0,
    "art": "fries",
    "image": "",
    "tags": [
     "vegetarian"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [],
    "defaults": [],
    "pairs": [
     "tzatziki-100",
     "urnebes-100"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 2,
    "demo": true
   },
   {
    "id": "pomfrit-feta",
    "categoryId": "prilozi",
    "name": "Pomfrit sa fetom",
    "description": "Pomfrit, izmrvljena feta i origano.",
    "price": 360,
    "comparePrice": 0,
    "art": "fries-feta",
    "image": "",
    "tags": [
     "vegetarian",
     "new"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [],
    "defaults": [],
    "pairs": [
     "tzatziki-100"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 3,
    "demo": true
   },
   {
    "id": "extra-pita",
    "categoryId": "prilozi",
    "name": "Pita iz Atine",
    "description": "Ista pita, sama. Za umakanje u tzatziki.",
    "price": 90,
    "comparePrice": 0,
    "art": "pita",
    "image": "",
    "tags": [
     "vegetarian"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [],
    "defaults": [],
    "pairs": [
     "tzatziki-100"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 4,
    "demo": true
   },
   {
    "id": "mix-salata",
    "categoryId": "salate",
    "name": "Mix salata",
    "description": "Paradajz, krastavac, zelena salata, ljubičasti kupus i luk.",
    "price": 290,
    "comparePrice": 0,
    "art": "salad",
    "image": "",
    "tags": [
     "vegetarian"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [],
    "defaults": [],
    "pairs": [],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 1,
    "demo": true
   },
   {
    "id": "kupus-salata",
    "categoryId": "salate",
    "name": "Kupus salata",
    "description": "Sitno seckan beli i ljubičasti kupus.",
    "price": 220,
    "comparePrice": 0,
    "art": "salad-cabbage",
    "image": "",
    "tags": [
     "vegetarian"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [],
    "defaults": [],
    "pairs": [],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 2,
    "demo": true
   },
   {
    "id": "tzatziki-100",
    "categoryId": "sosovi",
    "name": "Tzatziki 100 g",
    "description": "Jogurt, krastavac i beli luk.",
    "price": 120,
    "comparePrice": 0,
    "art": "sauce-white",
    "image": "",
    "tags": [
     "vegetarian",
     "popular"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [],
    "defaults": [],
    "pairs": [],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 1,
    "demo": true
   },
   {
    "id": "urnebes-100",
    "categoryId": "sosovi",
    "name": "Urnebes 100 g",
    "description": "Sir i ljuta paprika. Za one kojima je Ljutko malo.",
    "price": 120,
    "comparePrice": 0,
    "art": "sauce-red",
    "image": "",
    "tags": [
     "vegetarian",
     "spicy"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [],
    "defaults": [],
    "pairs": [],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 2,
    "demo": true
   },
   {
    "id": "tirokafteri-100",
    "categoryId": "sosovi",
    "name": "Tirokafteri 100 g",
    "description": "Grčki ljuti namaz od feta sira.",
    "price": 140,
    "comparePrice": 0,
    "art": "sauce-orange",
    "image": "",
    "tags": [
     "vegetarian",
     "spicy"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [],
    "defaults": [],
    "pairs": [],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 3,
    "demo": true
   },
   {
    "id": "tzatziki-300",
    "categoryId": "sosovi",
    "name": "Tzatziki 300 g",
    "description": "Za društvo, ili za sutra.",
    "price": 290,
    "comparePrice": 0,
    "art": "sauce-white",
    "image": "",
    "tags": [
     "vegetarian",
     "family"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [],
    "defaults": [],
    "pairs": [],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 4,
    "demo": true
   },
   {
    "id": "coca-cola",
    "categoryId": "pice",
    "name": "Coca-Cola 0.33 l",
    "description": "",
    "price": 200,
    "comparePrice": 0,
    "art": "can-red",
    "image": "",
    "tags": [],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [],
    "defaults": [],
    "pairs": [],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 1,
    "demo": true
   },
   {
    "id": "coca-cola-zero",
    "categoryId": "pice",
    "name": "Coca-Cola Zero 0.33 l",
    "description": "",
    "price": 200,
    "comparePrice": 0,
    "art": "can-black",
    "image": "",
    "tags": [],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [],
    "defaults": [],
    "pairs": [],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 2,
    "demo": true
   },
   {
    "id": "fanta",
    "categoryId": "pice",
    "name": "Fanta 0.33 l",
    "description": "",
    "price": 200,
    "comparePrice": 0,
    "art": "can-orange",
    "image": "",
    "tags": [],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [],
    "defaults": [],
    "pairs": [],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 3,
    "demo": true
   },
   {
    "id": "sprite",
    "categoryId": "pice",
    "name": "Sprite 0.33 l",
    "description": "",
    "price": 200,
    "comparePrice": 0,
    "art": "can-green",
    "image": "",
    "tags": [],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [],
    "defaults": [],
    "pairs": [],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 4,
    "demo": true
   },
   {
    "id": "voda",
    "categoryId": "pice",
    "name": "Negazirana voda 0.5 l",
    "description": "",
    "price": 150,
    "comparePrice": 0,
    "art": "bottle",
    "image": "",
    "tags": [],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [],
    "defaults": [],
    "pairs": [],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 5,
    "demo": true
   },
   {
    "id": "gazirana",
    "categoryId": "pice",
    "name": "Gazirana voda 0.5 l",
    "description": "",
    "price": 150,
    "comparePrice": 0,
    "art": "bottle-sparkling",
    "image": "",
    "tags": [],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [],
    "defaults": [],
    "pairs": [],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "sort": 6,
    "demo": true
   }
  ]
 }
};
