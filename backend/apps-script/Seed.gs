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
   "key": "EMAIL_1",
   "value": "nikola.jovanovic.mef@gmail.com",
   "note": "Email za obaveštenja (porudžbine, kontakt, CV prijave, izveštaji)"
  },
  {
   "key": "EMAIL_2",
   "value": "",
   "note": "Dodatni email za obaveštenja (prazno = ne koristi se)"
  },
  {
   "key": "EMAIL_3",
   "value": "",
   "note": "Dodatni email za obaveštenja (prazno = ne koristi se)"
  },
  {
   "key": "EMAIL_4",
   "value": "",
   "note": "Dodatni email za obaveštenja (prazno = ne koristi se)"
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
   "key": "test_mode",
   "value": "FALSE",
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
  },
  {
   "key": "address_note",
   "value": "kod stadiona „Karađorđe“",
   "note": "Orijentir uz adresu (prazno = ne prikazuje se)"
  },
  {
   "key": "hours_note",
   "value": "Ne radimo za vreme kolektivnog godišnjeg odmora (leti i zimi) i za praznike.",
   "note": "Napomena ispod radnog vremena (prazno = ne prikazuje se)"
  },
  {
   "key": "job_phone_display",
   "value": "063 877 33 63",
   "note": "Telefon za posao na stranici /posao/ (prazno = telefon lokala)"
  },
  {
   "key": "job_phone_e164",
   "value": "+381638773363",
   "note": "Isti broj u formatu +381…"
  },
  {
   "key": "second_location",
   "value": "Bulevar kralja Petra I 61, Novi Sad",
   "note": "Drugi lokal, samo kao informacija na stranici Kontakt (prazno = ne prikazuje se). Online porudžbine ostaju u lokalu iz address_street."
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
    "description": "Pileće, svinjsko ili mix — u grčkoj piti, sa pomfritom unutra.",
    "sort": 1,
    "active": true
   },
   {
    "id": "akcije",
    "name": "Akcije",
    "description": "Uz Coca-Colu u limenci, povoljnije nego odvojeno.",
    "sort": 2,
    "active": true
   },
   {
    "id": "rostilj",
    "name": "Sa roštilja",
    "description": "Pljeskavice, banjalučki ćevap i kobasica sa sirom.",
    "sort": 3,
    "active": true
   },
   {
    "id": "prilozi",
    "name": "Prilozi",
    "description": "Pomfrit i premazi.",
    "sort": 4,
    "active": true
   },
   {
    "id": "pice",
    "name": "Piće",
    "description": "Hladno.",
    "sort": 5,
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
    "id": "premazi",
    "name": "Premazi",
    "type": "multi",
    "required": false,
    "min": 0,
    "max": 0,
    "display": "chips",
    "hint": "Bez doplate, koliko god želite.",
    "sort": 2
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
    "sort": 3
   },
   {
    "id": "zacini",
    "name": "Začini",
    "type": "multi",
    "required": false,
    "min": 0,
    "max": 0,
    "display": "chips",
    "hint": "Originalni začini iz Grčke.",
    "sort": 4
   },
   {
    "id": "pomfrit-u-piti",
    "name": "Pomfrit u piti",
    "type": "multi",
    "required": false,
    "min": 0,
    "max": 1,
    "display": "toggle",
    "hint": "Isključite ako giros želite bez pomfrita.",
    "sort": 5
   },
   {
    "id": "pakovanje",
    "name": "Pakovanje",
    "type": "multi",
    "required": false,
    "min": 0,
    "max": 1,
    "display": "chips",
    "hint": "Bez pite: meso, premaz, pomfrit i salate u ketering stiroporu, ista cena.",
    "sort": 6
   },
   {
    "id": "dodatno",
    "name": "Dodatno",
    "type": "multi",
    "required": false,
    "min": 0,
    "max": 0,
    "display": "chips",
    "hint": "",
    "sort": 7
   },
   {
    "id": "uz-pomfrit",
    "name": "Uz pomfrit",
    "type": "multi",
    "required": false,
    "min": 0,
    "max": 0,
    "display": "chips",
    "hint": "Bez doplate.",
    "sort": 8
   },
   {
    "id": "premaz-izbor",
    "name": "Premaz",
    "type": "single",
    "required": true,
    "min": 1,
    "max": 1,
    "display": "chips",
    "hint": "",
    "sort": 9
   },
   {
    "id": "pakovanje-pica",
    "name": "Pakovanje",
    "type": "single",
    "required": true,
    "min": 1,
    "max": 1,
    "display": "chips",
    "hint": "",
    "sort": 10
   },
   {
    "id": "joy-ukus",
    "name": "Ukus",
    "type": "single",
    "required": true,
    "min": 1,
    "max": 1,
    "display": "chips",
    "hint": "",
    "sort": 11
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
    "id": "meso-mix",
    "groupId": "meso",
    "name": "Mix",
    "price": 0,
    "sort": 3,
    "available": true
   },
   {
    "id": "pr-pavlaka",
    "groupId": "premazi",
    "name": "Pavlaka",
    "price": 0,
    "sort": 1,
    "available": true
   },
   {
    "id": "pr-caciki",
    "groupId": "premazi",
    "name": "Caciki (tzatziki)",
    "price": 0,
    "sort": 2,
    "available": true
   },
   {
    "id": "pr-tirokafteri",
    "groupId": "premazi",
    "name": "Tirokafteri",
    "price": 0,
    "sort": 3,
    "available": true
   },
   {
    "id": "pr-urnebes",
    "groupId": "premazi",
    "name": "Urnebes",
    "price": 0,
    "sort": 4,
    "available": true
   },
   {
    "id": "pr-kecap",
    "groupId": "premazi",
    "name": "Kečap blagi",
    "price": 0,
    "sort": 5,
    "available": true
   },
   {
    "id": "pr-majonez",
    "groupId": "premazi",
    "name": "Majonez",
    "price": 0,
    "sort": 6,
    "available": true
   },
   {
    "id": "pr-senf",
    "groupId": "premazi",
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
    "id": "sal-vitaminska",
    "groupId": "salate",
    "name": "Vitaminska",
    "price": 0,
    "sort": 3,
    "available": true
   },
   {
    "id": "sal-lj-kupus",
    "groupId": "salate",
    "name": "Ljubičasti kupus",
    "price": 0,
    "sort": 4,
    "available": true
   },
   {
    "id": "sal-beli-kupus",
    "groupId": "salate",
    "name": "Beli kupus",
    "price": 0,
    "sort": 5,
    "available": true
   },
   {
    "id": "sal-luk",
    "groupId": "salate",
    "name": "Ljubičasti luk",
    "price": 0,
    "sort": 6,
    "available": true
   },
   {
    "id": "sal-zelena",
    "groupId": "salate",
    "name": "Zelena salata",
    "price": 0,
    "sort": 7,
    "available": true
   },
   {
    "id": "zac-biber",
    "groupId": "zacini",
    "name": "Crni biber",
    "price": 0,
    "sort": 1,
    "available": true
   },
   {
    "id": "zac-paprika",
    "groupId": "zacini",
    "name": "Tucana žuta paprika",
    "price": 0,
    "sort": 2,
    "available": true
   },
   {
    "id": "zac-morska-so",
    "groupId": "zacini",
    "name": "Morska so",
    "price": 0,
    "sort": 3,
    "available": true
   },
   {
    "id": "zac-origano",
    "groupId": "zacini",
    "name": "Grčki origano",
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
    "id": "pak-stiropor",
    "groupId": "pakovanje",
    "name": "Bez pite — u ketering stiroporu",
    "price": 0,
    "sort": 1,
    "available": true
   },
   {
    "id": "dod-meso",
    "groupId": "dodatno",
    "name": "Meso plus 100 g",
    "price": 330,
    "sort": 1,
    "available": true
   },
   {
    "id": "uzp-kecap",
    "groupId": "uz-pomfrit",
    "name": "Kečap blagi",
    "price": 0,
    "sort": 1,
    "available": true
   },
   {
    "id": "uzp-majonez",
    "groupId": "uz-pomfrit",
    "name": "Majonez",
    "price": 0,
    "sort": 2,
    "available": true
   },
   {
    "id": "uzp-senf",
    "groupId": "uz-pomfrit",
    "name": "Senf",
    "price": 0,
    "sort": 3,
    "available": true
   },
   {
    "id": "uzp-so",
    "groupId": "uz-pomfrit",
    "name": "So",
    "price": 0,
    "sort": 4,
    "available": true
   },
   {
    "id": "pi-pavlaka",
    "groupId": "premaz-izbor",
    "name": "Pavlaka",
    "price": 0,
    "sort": 1,
    "available": true
   },
   {
    "id": "pi-caciki",
    "groupId": "premaz-izbor",
    "name": "Caciki (tzatziki)",
    "price": 0,
    "sort": 2,
    "available": true
   },
   {
    "id": "pi-tirokafteri",
    "groupId": "premaz-izbor",
    "name": "Tirokafteri",
    "price": 0,
    "sort": 3,
    "available": true
   },
   {
    "id": "pi-urnebes",
    "groupId": "premaz-izbor",
    "name": "Urnebes",
    "price": 0,
    "sort": 4,
    "available": true
   },
   {
    "id": "pi-kecap",
    "groupId": "premaz-izbor",
    "name": "Kečap blagi",
    "price": 0,
    "sort": 5,
    "available": true
   },
   {
    "id": "pi-majonez",
    "groupId": "premaz-izbor",
    "name": "Majonez",
    "price": 0,
    "sort": 6,
    "available": true
   },
   {
    "id": "pi-senf",
    "groupId": "premaz-izbor",
    "name": "Senf",
    "price": 0,
    "sort": 7,
    "available": true
   },
   {
    "id": "pp-limenka",
    "groupId": "pakovanje-pica",
    "name": "Limenka 0,33 l",
    "price": 0,
    "sort": 1,
    "available": true
   },
   {
    "id": "pp-flasa",
    "groupId": "pakovanje-pica",
    "name": "Flaša 0,5 l",
    "price": 0,
    "sort": 2,
    "available": true
   },
   {
    "id": "joy-narandza",
    "groupId": "joy-ukus",
    "name": "Narandža",
    "price": 0,
    "sort": 1,
    "available": true
   },
   {
    "id": "joy-multivitamin",
    "groupId": "joy-ukus",
    "name": "Multivitamin",
    "price": 0,
    "sort": 2,
    "available": true
   },
   {
    "id": "joy-visnja",
    "groupId": "joy-ukus",
    "name": "Višnja",
    "price": 0,
    "sort": 3,
    "available": true
   }
  ],
  "products": [
   {
    "comparePrice": 0,
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
     "premazi",
     "salate",
     "zacini",
     "pomfrit-u-piti",
     "pakovanje",
     "dodatno"
    ],
    "defaults": [
     "pr-caciki",
     "sal-paradajz",
     "sal-luk",
     "pup-da"
    ],
    "pairs": [
     "coca-cola",
     "pomfrit",
     "premaz-100"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "demo": false,
    "categoryId": "giros",
    "sort": 1,
    "id": "giros-veliki",
    "name": "Giros veliki",
    "description": "120 g mesa u grčkoj piti, sa pomfritom. Premaze, salate i začine birate sami, bez doplate.",
    "price": 550,
    "art": "wrap"
   },
   {
    "comparePrice": 0,
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
     "premazi",
     "salate",
     "zacini",
     "pomfrit-u-piti",
     "pakovanje",
     "dodatno"
    ],
    "defaults": [
     "pr-caciki",
     "sal-paradajz",
     "sal-luk",
     "pup-da"
    ],
    "pairs": [
     "coca-cola",
     "pomfrit"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "demo": false,
    "categoryId": "giros",
    "sort": 2,
    "id": "giros-mali",
    "name": "Giros mali",
    "description": "80 g mesa u grčkoj piti, sa pomfritom. Premaze, salate i začine birate sami, bez doplate.",
    "price": 450,
    "art": "wrap-mali"
   },
   {
    "comparePrice": 0,
    "image": "",
    "tags": [
     "family"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "meso",
     "premazi",
     "salate",
     "zacini",
     "dodatno"
    ],
    "defaults": [],
    "pairs": [
     "coca-cola",
     "pomfrit"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "demo": false,
    "categoryId": "giros",
    "sort": 3,
    "id": "giros-porcija",
    "name": "Giros porcija",
    "description": "250 g mesa po izboru. Premazi, salate i začini po želji, bez doplate.",
    "price": 950,
    "art": "plate"
   },
   {
    "comparePrice": 0,
    "image": "",
    "tags": [
     "vegetarian"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "premazi",
     "salate",
     "zacini",
     "pomfrit-u-piti"
    ],
    "defaults": [
     "pr-caciki",
     "sal-paradajz",
     "sal-luk",
     "pup-da"
    ],
    "pairs": [
     "coca-cola"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "demo": false,
    "categoryId": "giros",
    "sort": 4,
    "id": "vege-veliki",
    "name": "Vege veliki",
    "description": "Grčka pita sa premazima, salatama i pomfritom — bez mesa.",
    "price": 450,
    "art": "wrap-veg"
   },
   {
    "comparePrice": 0,
    "image": "",
    "tags": [
     "vegetarian"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "premazi",
     "salate",
     "zacini",
     "pomfrit-u-piti"
    ],
    "defaults": [
     "pr-caciki",
     "sal-paradajz",
     "sal-luk",
     "pup-da"
    ],
    "pairs": [
     "coca-cola"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "demo": false,
    "categoryId": "giros",
    "sort": 5,
    "id": "vege-mali",
    "name": "Vege mali",
    "description": "Manja grčka pita sa premazima, salatama i pomfritom — bez mesa.",
    "price": 350,
    "art": "wrap-veg"
   },
   {
    "comparePrice": 700,
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
     "premazi",
     "salate",
     "zacini",
     "pomfrit-u-piti",
     "pakovanje",
     "dodatno"
    ],
    "defaults": [
     "pr-caciki",
     "sal-paradajz",
     "sal-luk",
     "pup-da"
    ],
    "pairs": [],
    "bundleHint": "p:giros-veliki+p:coca-cola",
    "includes": "Giros veliki · Coca-Cola limenka 0,33 l",
    "kind": "bundle",
    "demo": false,
    "categoryId": "akcije",
    "sort": 1,
    "id": "akcija-giros-veliki",
    "name": "Giros veliki + Coca-Cola",
    "description": "Giros veliki složen po vašem ukusu i Coca-Cola u limenci.",
    "price": 650,
    "art": "bundle-1"
   },
   {
    "comparePrice": 600,
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
     "premazi",
     "salate",
     "zacini",
     "pomfrit-u-piti",
     "pakovanje",
     "dodatno"
    ],
    "defaults": [
     "pr-caciki",
     "sal-paradajz",
     "sal-luk",
     "pup-da"
    ],
    "pairs": [],
    "bundleHint": "p:giros-mali+p:coca-cola",
    "includes": "Giros mali · Coca-Cola limenka 0,33 l",
    "kind": "bundle",
    "demo": false,
    "categoryId": "akcije",
    "sort": 2,
    "id": "akcija-giros-mali",
    "name": "Giros mali + Coca-Cola",
    "description": "Giros mali složen po vašem ukusu i Coca-Cola u limenci.",
    "price": 550,
    "art": "bundle-1"
   },
   {
    "comparePrice": 600,
    "image": "/assets/img/menu/pljeskavica.webp",
    "tags": [
     "promo",
     "value"
    ],
    "badge": "Akcija",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "premazi",
     "salate"
    ],
    "defaults": [],
    "pairs": [],
    "bundleHint": "p:pljeskavica-velika+p:coca-cola",
    "includes": "Pljeskavica velika · Coca-Cola limenka 0,33 l",
    "kind": "bundle",
    "demo": false,
    "categoryId": "akcije",
    "sort": 3,
    "id": "akcija-pljeskavica",
    "name": "Pljeskavica velika + Coca-Cola",
    "description": "Pljeskavica velika (200 g) i Coca-Cola u limenci.",
    "price": 550,
    "art": "plate"
   },
   {
    "comparePrice": 0,
    "image": "/assets/img/menu/pljeskavica.webp",
    "tags": [
     "popular"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "premazi",
     "salate"
    ],
    "defaults": [],
    "pairs": [
     "pomfrit",
     "coca-cola"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "demo": false,
    "categoryId": "rostilj",
    "sort": 1,
    "id": "pljeskavica-velika",
    "name": "Pljeskavica velika",
    "description": "200 g. Premazi i salate po želji, bez doplate.",
    "price": 450,
    "art": "plate"
   },
   {
    "comparePrice": 0,
    "image": "/assets/img/menu/pljeskavica.webp",
    "tags": [],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "premazi",
     "salate"
    ],
    "defaults": [],
    "pairs": [
     "pomfrit",
     "coca-cola"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "demo": false,
    "categoryId": "rostilj",
    "sort": 2,
    "id": "pljeskavica-mala",
    "name": "Pljeskavica mala",
    "description": "150 g. Premazi i salate po želji, bez doplate.",
    "price": 400,
    "art": "plate"
   },
   {
    "comparePrice": 0,
    "image": "/assets/img/menu/gurmanska.webp",
    "tags": [],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "premazi",
     "salate"
    ],
    "defaults": [],
    "pairs": [
     "pomfrit",
     "coca-cola"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "demo": false,
    "categoryId": "rostilj",
    "sort": 3,
    "id": "gurmanska",
    "name": "Gurmanska pljeskavica",
    "description": "200 g. Premazi i salate po želji, bez doplate.",
    "price": 500,
    "art": "plate"
   },
   {
    "comparePrice": 0,
    "image": "/assets/img/menu/banjalucki-cevap.webp",
    "tags": [],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "premazi",
     "salate"
    ],
    "defaults": [],
    "pairs": [
     "pomfrit",
     "coca-cola"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "demo": false,
    "categoryId": "rostilj",
    "sort": 4,
    "id": "banjalucki-cevap",
    "name": "Banjalučki ćevap",
    "description": "200 g. Premazi i salate po želji, bez doplate.",
    "price": 600,
    "art": "plate"
   },
   {
    "comparePrice": 0,
    "image": "/assets/img/menu/kobasica.webp",
    "tags": [],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "premazi",
     "salate"
    ],
    "defaults": [],
    "pairs": [
     "pomfrit",
     "coca-cola"
    ],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "demo": false,
    "categoryId": "rostilj",
    "sort": 5,
    "id": "kobasica-sa-sirom",
    "name": "Kobasica sa sirom",
    "description": "200 g, dva komada. Premazi i salate po želji, bez doplate.",
    "price": 600,
    "art": "plate"
   },
   {
    "comparePrice": 0,
    "image": "",
    "tags": [
     "popular"
    ],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "uz-pomfrit"
    ],
    "defaults": [],
    "pairs": [],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "demo": false,
    "categoryId": "prilozi",
    "sort": 1,
    "id": "pomfrit",
    "name": "Pomfrit porcija",
    "description": "Na pomfrit može premaz bez doplate: kečap blagi, majonez, senf ili so.",
    "price": 230,
    "art": "fries"
   },
   {
    "comparePrice": 0,
    "image": "",
    "tags": [],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "premaz-izbor"
    ],
    "defaults": [],
    "pairs": [],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "demo": false,
    "categoryId": "prilozi",
    "sort": 2,
    "id": "premaz-100",
    "name": "Premaz 100 g",
    "description": "Dodatni premaz, za giros ili za umakanje.",
    "price": 190,
    "art": "sauce-white"
   },
   {
    "comparePrice": 0,
    "image": "",
    "tags": [],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "pakovanje-pica"
    ],
    "defaults": [
     "pp-limenka"
    ],
    "pairs": [],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "demo": false,
    "categoryId": "pice",
    "sort": 1,
    "id": "coca-cola",
    "name": "Coca-Cola",
    "description": "Limenka 0,33 l ili flaša 0,5 l.",
    "price": 150,
    "art": "can-red"
   },
   {
    "comparePrice": 0,
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
    "demo": false,
    "categoryId": "pice",
    "sort": 2,
    "id": "coca-cola-zero",
    "name": "Coca-Cola Zero 0,33 l",
    "description": "Limenka.",
    "price": 150,
    "art": "can-black"
   },
   {
    "comparePrice": 0,
    "image": "",
    "tags": [],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "pakovanje-pica"
    ],
    "defaults": [
     "pp-limenka"
    ],
    "pairs": [],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "demo": false,
    "categoryId": "pice",
    "sort": 3,
    "id": "fanta",
    "name": "Fanta",
    "description": "Limenka 0,33 l ili flaša 0,5 l.",
    "price": 150,
    "art": "can-orange"
   },
   {
    "comparePrice": 0,
    "image": "",
    "tags": [],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "pakovanje-pica"
    ],
    "defaults": [
     "pp-limenka"
    ],
    "pairs": [],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "demo": false,
    "categoryId": "pice",
    "sort": 4,
    "id": "sprite",
    "name": "Sprite",
    "description": "Limenka 0,33 l ili flaša 0,5 l.",
    "price": 150,
    "art": "can-green"
   },
   {
    "comparePrice": 0,
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
    "demo": false,
    "categoryId": "pice",
    "sort": 5,
    "id": "schweppes",
    "name": "Schweppes 0,5 l",
    "description": "Flaša.",
    "price": 150,
    "art": "bottle"
   },
   {
    "comparePrice": 0,
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
    "demo": false,
    "categoryId": "pice",
    "sort": 6,
    "id": "ultra",
    "name": "Ultra 0,25 l",
    "description": "Limenka.",
    "price": 150,
    "art": "can-black"
   },
   {
    "comparePrice": 0,
    "image": "",
    "tags": [],
    "badge": "",
    "available": true,
    "delivery": true,
    "pickup": true,
    "groups": [
     "joy-ukus"
    ],
    "defaults": [],
    "pairs": [],
    "bundleHint": "",
    "includes": "",
    "kind": "item",
    "demo": false,
    "categoryId": "pice",
    "sort": 7,
    "id": "joy",
    "name": "Joy sok 0,5 l",
    "description": "Narandža, multivitamin ili višnja.",
    "price": 150,
    "art": "bottle"
   },
   {
    "comparePrice": 0,
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
    "demo": false,
    "categoryId": "pice",
    "sort": 8,
    "id": "rosa",
    "name": "Rosa negazirana 0,5 l",
    "description": "",
    "price": 150,
    "art": "bottle"
   },
   {
    "comparePrice": 0,
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
    "demo": false,
    "categoryId": "pice",
    "sort": 9,
    "id": "knjaz-milos",
    "name": "Knjaz Miloš gazirana 0,5 l",
    "description": "",
    "price": 150,
    "art": "bottle-sparkling"
   },
   {
    "comparePrice": 0,
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
    "demo": false,
    "categoryId": "pice",
    "sort": 10,
    "id": "pivo-alfa",
    "name": "Pivo Alfa 0,5 l",
    "description": "Limenka. Samo za punoletne.",
    "price": 300,
    "art": "can-black"
   },
   {
    "comparePrice": 0,
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
    "demo": false,
    "categoryId": "pice",
    "sort": 11,
    "id": "pivo-tuborg",
    "name": "Pivo Tuborg 0,5 l",
    "description": "Limenka. Samo za punoletne.",
    "price": 250,
    "art": "can-green"
   },
   {
    "comparePrice": 0,
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
    "demo": false,
    "categoryId": "pice",
    "sort": 12,
    "id": "pivo-lav",
    "name": "Pivo Lav 0,5 l",
    "description": "Limenka. Samo za punoletne.",
    "price": 250,
    "art": "can-red"
   }
  ]
 }
};
