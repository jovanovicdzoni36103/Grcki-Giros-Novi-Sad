# Uputstvo za lokal — admin panel

Sve što se menja u svakodnevnom radu menja se u **admin panelu**:

**grckigiros.rs/admin/**

Radi na tabletu, telefonu i računaru. Ne treba vam Google tabela i ne treba vam programer. Izmena se na sajtu vidi za najviše jedan minut.

---

## 1. Prijava

1. Otvorite **grckigiros.rs/admin/**.
2. Ukucajte PIN (6 do 8 cifara) i dodirnite zelenu kvačicu.
3. Dok je panel otvoren, prijava se sama produžava, pa vas usred smene neće izbaciti. Uređaj koji niko nije koristio 12 sati ponovo traži PIN.

Na tabletu u lokalu: u Chrome-u otvorite adresu, pa **meni ⋮ ▸ Dodaj na početni ekran**. Dok je panel otvoren, sam drži ekran uključenim (Chrome na Androidu i računaru). Ne prebacujte se na drugu aplikaciju: kada panel nije na ekranu, tablet ga usporava i nova porudžbina može da zazvoni sa zakašnjenjem. Zvuk neka bude pojačan.

**Dva uređaja** (tablet u kuhinji i telefon vlasnika) mogu da rade istovremeno. Ako je jedan već prihvatio porudžbinu, a na drugom ekran još nije osvežen, dugme na drugom neće ništa pokvariti: panel javi „Porudžbina je u međuvremenu promenjena (na drugom uređaju)“ i osveži se.

**Zvuk:** posle otvaranja panela dodirnite ekran jednom. Telefoni i tableti puštaju zvuk tek posle prvog dodira. Zvono gore desno uključuje ili isključuje zvuk.

Posle 8 pogrešnih PIN-ova panel se zaključa na 10 minuta.

**Izgubljen ili ukraden telefon sa panelom:** u Podešavanjima promenite PIN. Svi ostali uređaji su odmah odjavljeni.

---

## 2. Kad stigne nova porudžbina

Dešavaju se tri stvari:

- **Zvuk**: ponavlja se na svakih 20 sekundi dok porudžbinu ne prihvatite ili odbijete (najviše 5 minuta).
- **Žuta traka na vrhu**: „Nova porudžbina #1042 čeka potvrdu“. Naziv kartice u pregledaču počinje brojem novih porudžbina.
- **Email** na adrese iz Podešavanja.

Dugme **Utišaj** gasi zvuk za porudžbine koje su već stigle. Traka ostaje dok ih ne rešite. Nova porudžbina ponovo pušta zvuk.

### Rok od 5 minuta

Svaka nova porudžbina ima odbrojavanje: **„Prihvatite za 3:12“**.

- Porudžbina **nikad nije potvrđena sama od sebe**. Kupac vidi „čeka potvrdu“ sve dok je vi ne prihvatite.
- Kada rok istekne, kartica postaje crvena i piše **„KASNI 2 min — pozovite kupca“**. Kupcu na stranici piše da lokal još nije potvrdio porudžbinu i da vas pozove.
- U **Pregledu** broj u polju „Istekao rok (5 min)“ pokazuje koliko porudžbina kasni.

Rok se menja u **Procena vremena ▸ Rok za prihvatanje**.

---

## 3. Prihvatanje porudžbine

1. Sekcija **Nove porudžbine** (ili dugme **Otvori** na žutoj traci).
2. Na kartici proverite broj, dostavu ili preuzimanje, vreme (**ŠTO PRE** ili **ZAKAZANO** sa danom i satom), kupca, telefon, adresu, stavke, napomenu i iznos.
3. Dodirnite žuto dugme **Prihvati**.

Porudžbina prelazi u **Aktivne**. Kupac vidi „Potvrđena“, a ako je ostavio email, stiže mu potvrda.

Dugme **Detalji** otvara sve na jednom mestu: zonu, sprat i stan, napomenu za dostavljača, cene po stavci, dodatke po komadu, dostavu, ukupno i kusur.

---

## 4. Odbijanje porudžbine

1. Na kartici dodirnite crveno **Odbij**.
2. Potvrdite pitanje.

Kupac odmah vidi „Odbijena — ništa ne plaćate“, a ako je ostavio email, stiže mu i email. Razlog ne morate da upisujete. Porudžbina ostaje u **Istoriji**.

**Odbijena porudžbina se ne može vratiti.** Ako ste pogrešili, pozovite kupca.

---

## 5. Promena statusa

U sekciji **Aktivne** su tri kolone: **Potvrđene → U pripremi → Spremne**.

| Status sada | Dugme | Šta vidi kupac |
|---|---|---|
| Potvrđena | **U pripremu** | ● U pripremi |
| U pripremi | **Spremna** | ● Spremna (kod preuzimanja dobija i email „možete da dođete“) |
| Spremna | **Isporučeno** (dostava) / **Preuzeto** (preuzimanje) | ✓ Završena, i poziv da oceni porudžbinu |

- **Vrati korak**: ako ste greškom dodirnuli, vraća porudžbinu jedan korak nazad.
- **Otkaži**: kad kupac pozove da otkaže. Kupac na sajtu **ne može sam da otkaže**, samo telefonom.

---

## 6. Promena cene

1. **Proizvodi**.
2. Kod proizvoda dodirnite **Izmeni**.
3. U polje **Cena (RSD)** upišite broj bez tačke i „RSD“, na primer `690`.
4. **Sačuvaj izmene**.

Stare porudžbine **zadržavaju staru cenu**. Menja se samo za nove porudžbine.

Kupac koji je baš tada imao proizvod u korpi dobija poruku da se cena promenila i vidi novi iznos pre slanja.

---

## 7. Dodavanje proizvoda

1. **Proizvodi ▸ + Novi proizvod**.
2. Popunite **Naziv**, **Kategorija**, **Cena** i **Opis**.
3. **Slika**: dodirnite **Dodaj fotografiju** i izaberite fotografiju sa telefona ili računara. Smanjuje se sama i čuva u Google Drive-u lokala. Bez fotografije se prikazuje ilustracija koju izaberete.
4. **Dodaci i opcije**: označite grupe koje kupac bira (npr. Meso, Sosovi, Dodaci). Ispod svake grupe označite šta je već uključeno kad kupac otvori proizvod.
5. **Dostupnost**: „Na meniju“ i „Dostupno“ neka budu uključeni.
6. **Dodaj proizvod**.

Novi proizvod ide na kraj svoje kategorije. Strelicama **˄ ˅** pomerate ga gore ili dole.

---

## 8. Kad nešto nestane (deaktivacija)

Postoje dva prekidača:

| Prekidač | Kada | Šta vidi kupac |
|---|---|---|
| **Dostupno** isključeno | nestalo je danas (rasprodato) | proizvod je na meniju sa oznakom „Trenutno nema“ i ne može da se doda |
| **Na meniju** isključeno | proizvod se više ne prodaje | proizvod se ne vidi na sajtu |

Oba prekidača su na listi proizvoda, bez otvaranja proizvoda. Kad se vrati, samo ih ponovo uključite.

Ako proizvod nestane dok ga kupac ima u korpi, kupac pri slanju dobija poruku „Trenutno nema: …“ i mora da ga ukloni.

---

## 9. Kategorije

**Kategorije** u meniju:

- **+ Nova kategorija**: naziv i kratak opis.
- **Izmeni**: promena naziva.
- Prekidač **Uključena**: isključena kategorija sakriva sve svoje proizvode.
- Strelice **˄ ˅**: redosled kategorija na meniju.

Proizvod se u drugu kategoriju premešta u **Proizvodi ▸ Izmeni ▸ Kategorija**.

---

## 10. Dodaci

**Dodaci** su grupe izbora (Meso, Sosovi, Salate, Dodaci…) i opcije u njima.

- **+ Opcija** u grupi: naziv i **doplata** (0 = bez doplate), npr. „Extra sir“, 120.
- **Izmeni** kod opcije: promena naziva ili doplate.
- Prekidač **Dostupno** kod opcije: kad ponestane (npr. nema slanine).
- **Izmeni grupu**: „Tačno jedan“ (npr. meso) ili „Više izbora“ (npr. sosovi), da li je izbor obavezan i koliko najviše izbora.
- **+ Nova grupa**: nova vrsta izbora. Zatim je u **Proizvodi ▸ Izmeni** označite kod proizvoda.

Kupac koji poruči više komada istog proizvoda može **svaki komad da složi drugačije** (npr. jedan Klasik sa extra mesom, drugi bez luka). U kuhinji se to vidi kao odvojene stavke.

---

## 11. Zone dostave i cena dostave

**Zone dostave**:

- Svaka zona ima **naziv**, **naselja** (zarezom odvojena), **cenu dostave** i **minimalnu porudžbinu**.
- **Izmeni**: promenite cenu dostave ili minimum i sačuvajte.
- **+ Nova zona**: novo područje. Ako ne upišete minimum, važi **500 RSD**.
- Prekidač **Aktivna**: isključena zona ne prima dostavu.

Kupac bira naselje sa spiska. Ako ga nema i izabere „Mog naselja nema na spisku“, sajt mu kaže da dostava tu nije dostupna i ponudi preuzimanje. Porudžbina ispod minimuma se ne može poslati, a kupac vidi koliko još nedostaje.

---

## 12. Radno vreme i pauza

**Radno vreme**:

1. Za svaki dan: prekidač **Radi**, vreme **Lokal** (otvaranje–zatvaranje), **Dostava** (od–do) i **Pauza** (od–do, ako postoji).
2. Vreme pišite kao `09:00`. Zatvaranje posle ponoći (npr. `01:00`) je u redu.
3. **Sačuvaj radno vreme**.

Van radnog vremena i tokom pauze **meni ostaje vidljiv**, ali poručivanje je zatvoreno: „Trenutno ne primamo porudžbine“. Posle pauze sistem **sam** nastavlja da prima porudžbine. Zakazani termini nikad ne padaju u pauzu ni van radnog vremena.

Praznici (npr. Nova godina) upisuju se u Google tabelu, list **SPECIAL_HOURS**. Ovo se radi par puta godišnje.

---

## 13. Ugasiti sve porudžbine

**Dostupnost poručivanja ▸ Online poručivanje** — isključite prekidač i potvrdite.

- Meni ostaje vidljiv, ali niko ne može da poruči.
- Gore u panelu piše **„Poručivanje PAUZIRANO“**.
- Poruku koju kupci vide menjate u polju **Poruka kupcima tokom pauze**.

Kad uključite ponovo, poručivanje odmah radi.

---

## 14. Ugasiti samo dostavu

**Dostupnost poručivanja ▸ Dostava** — isključite. Preuzimanje i dalje radi, a kupcima piše „Dostava je trenutno isključena“.

## 15. Ugasiti samo preuzimanje

**Dostupnost poručivanja ▸ Preuzimanje u lokalu** — isključite. Dostava i dalje radi.

---

## 16. Vreme pripreme (procena)

**Procena vremena**:

- **Preuzimanje** najkraće–najduže (npr. 15–30 minuta).
- **Dostava** najkraće–najduže (npr. 45–60 minuta).
- **Gužva**: dodatni minuti na sve procene, dok ga ne vratite na 0. Brže je preko **Dostupnost poručivanja ▸ Gužva (+15 / +30 / +45)**.
- **Rok za prihvatanje** (5 minuta) i **Zakazivanje najviše dana unapred** (7).

Kupac vidi procenu kod izbora „Što pre“ i na potvrdi.

---

## 17. Istorija porudžbina

**Istorija**: pretraga po **broju** (npr. `1042`), **imenu**, **telefonu** (može i `064 123`), **datumu** i **statusu**. Dodir na red otvara sve detalje.

## 18. Dnevni pregled

**Pregled**: broj porudžbina danas, vrednost (bez odbijenih), dostava / preuzimanje, završene, odbijene, one koje čekaju potvrdu i one kojima je istekao rok.

## 19. Feedback kupaca

Posle **Završene** porudžbine kupac može da ostavi ocenu od 1 do 5, da označi šta je bilo dobro i šta može bolje, i da napiše komentar.

**Feedback** u panelu prikazuje prosečnu ocenu, raspodelu i sve komentare, najnovije gore.

---

## Brojevi porudžbina

Porudžbine su numerisane **#1001, #1002, #1003…** i broj se nikad ne ponavlja. Svaka porudžbina ima i interni ID (npr. `GG-20260923-1042-00A4`) po kome se traži u tabeli.

## Podešavanja

**Podešavanja**: naziv i adresa lokala, telefon, javni email, **ko dobija email za novu porudžbinu** (više adresa odvojite zarezom), minimalna porudžbina kad zona nema svoj minimum, emailovi kupcima i **promena PIN-a**.

## Ne dirati u Google tabeli

Tabela „Grčki Giros — porudžbine“ je pozadina sistema. U njoj **ne menjajte**:

- nazive kolona (prvi red svakog lista)
- listove ORDERS, ORDER_ITEMS, FEEDBACK, *_STATS, *_LOG (puni ih sistem)
- kolonu `id` kod proizvoda, kategorija, dodataka i zona
- `timezone` i `test_mode` u SETTINGS

## Kad nešto ne radi

- **„Nema veze“ gore levo**: panel sam pokušava ponovo. Proverite internet na tabletu.
- **Sesija je istekla**: unesite PIN ponovo (dešava se samo na uređaju koji dugo nije korišćen, ili kada je neko promenio PIN).
- **Crvena traka „Test režim je uključen“**: emailovi o porudžbinama ne idu kuhinji ni kupcima. Javite osobi koja je postavila sistem; u tabeli SETTINGS `test_mode` treba da bude FALSE.
- **Porudžbine ne stižu na email** ili crvena traka **„Email kvota za danas je skoro potrošena“**: besplatan Gmail šalje najviše 100 emailova dnevno. Kad ostane 10, kupcima se emailovi više ne šalju, a kuhinja dobija samo prvu adresu. Porudžbine u admin panelu stižu i kad email ne radi, a kvota se obnavlja sutra. Detalji su u Google tabeli, meni **Grčki Giros ▸ Stanje sistema**.
