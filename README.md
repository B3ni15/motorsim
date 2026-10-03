# Volkswagen Golf 7.5 R (2019) – élő autó- és motorszimuláció

Volkswagen Golf 7.5 R (2019, EU, OPF) élő fizikai szimulációja Next.js-ben, teljes 3D autóval
(three.js / react-three-fiber), belső nézettel, átlátszó röntgen nézettel, szintetizált hanggal
és maradandó károkkal.

## Indítás

```bash
npm install
npm run dev
```

Majd nyisd meg: http://localhost:3000

## Tesztek

```bash
npm test               # fizika, károk, hangszintézis, motor- és karosszéria-geometria (vitest)
npm run test:browser   # böngészős tesztek (fut a dev szerver mellett, Chromium kell hozzá)
```

A böngészős teszt (`scripts/browser-test.mjs`):

- **illeszkedés-ellenőrzés**: a `/teszt?fit=1` oldal minden 3D alkatrész csúcspontjait az autó
  koordinátáiba transzformálja, és ellenőrzi, hogy a karosszérián belül vannak-e (nem lóg át a
  motorháztetőn, tetőn, ablakon, oldalfalon, nem ér le a talajra);
- vezetés: indítás, elindulás (az EPB magától kiold), váltás, csikorgás kuplung nélkül;
- minden kameranézet bejárása képernyőképekkel; a váltókar egérrel húzása a H-kulisszában;
- a hang (AudioWorklet) valóban szól-e; konzolhibák.

A `geometry.test.ts` minden főtengely-szögnél ellenőrzi, hogy a dugattyú nem ütközik a
szelepekkel, és hogy a kerekek a karosszérián / kerékíven belül maradnak.

## Nézetek

| Nézet | Leírás |
|-------|--------|
| Külső | körbeforgatható külső nézet; az ajtókra, motorháztetőre, csomagtérajtóra kattintva nyílnak |
| Belső (vezető) | a vezetőülésből; körbenézhető, a műszerfal (Active Info Display) és a Discover Pro kijelző élő, a **váltókar egérrel húzható**, a gombok kattinthatók |
| Üldöző kamera | az autó mögött követ |
| Motortér | kinyílik a motorháztető, látszik a motor |
| Röntgen (skeleton) | átlátszó karosszéria – a régi „váz” nézet: Teljes autó, Motor, Hengerek, Hajtáslánc (4MOTION), Fékek, Turbó + kipufogó, élő feliratokkal |

## Vezérlés

| Billentyű | Funkció |
|-----------|---------|
| I / Enter | Start/Stop gomb (kuplunggal: indítás, kuplung nélkül: csak gyújtás, járó motornál: leállítás) |
| W / ↑ · S / ↓ | gáz · fék |
| Space (tartva) | kuplung; felengedés lassú = félkuplung |
| A / D · ← / → | kormány (sebességfüggő) |
| 1–6, R, N/0, Q/E | fokozat – csak kuplunggal! |
| P (tartva) / O | rögzítőfék húzása (menet közben: vészfékezés) / oldása (fékpedállal) |
| H · M | Auto Hold · vezetési mód (Comfort / Normal / Race) |
| V · J / K · F · B · T | fényszóró · index · vészvillogó · kürt · ablaktörlő |
| G · C | vezetőajtó · biztonsági öv |
| Tab · X | következő nézet · röntgen ki/be |

## Fizika (src/lib/engine.ts)

Fix 0,5 ms-os lépés (2000 lépés/s).

- **Motor:** EA888 Gen3 2.0 TSI, 1984 cm³, 82,5 × 92,8 mm, hajtókar 144 mm, 9,3:1, gyújtási sorrend
  1-3-4-2, 221 kW / 380 Nm (2000–5300), alapjárat 750 (hidegen 1150), határoló 6800, 250 km/h
  végsebesség-korlát, túlfutási üzemanyag-lezárás, lefulladásgátló (kuplungfelengedéskor emelt alapjárat)
- **IS38 turbó:** turbófordulat a kipufogógáz-áramból (turbólyuk), wastegate-szabályzás ~1,25 bar-ig,
  lefúvató (diverter) szelep gázelvételkor, intercooler
- **ECU:** elektronikus gázpedál nyomatékigénnyel (Comfort/Normal/Race gázpedál-karakterisztika),
  FSI + MPI befecskendezés, λ=1 / hidegindítási / teljes terhelésű dúsítás, kopogásszabályzás, ASR
- **Hajtáslánc:** 02Q 6 fokozat + R (3,36 / 2,09 / 1,48 / 1,09 / 0,85 / 0,70, R 3,82), 4,24 végáttétel,
  kettős tömegű lendkerék, kuplung hőmérséklettel, 4MOTION (Haldex: terhelésre max 50% hátra),
  235/35 R19, 1505 kg, kormányzás (egynyomú modell, tapadási korláttal)
- **EPB + Auto Hold:** valós logika – álló helyzetben behúz, oldás csak fékpedállal, elinduláskor
  magától old (ha az öv be van kötve és az ajtó csukva), menet közben tartva ESC-vészfékezés
- **Hő, elektromos rendszer, fékek, kipufogó (kat + OPF, 4 végcső)** – fading, fékfolyadék-forrás stb.

### Maradandó károk – csak az oldal újratöltése javítja

| Kár | Kiváltó ok | Következmény |
|-----|-----------|--------------|
| Szinkron / fokozat | kuplung nélküli váltás (4 csikorgás) | a fokozat nem kapcsolható |
| Hátramenet | mozgó autónál R | R letörik |
| Szelepek | mechanikus túlpörgetés > 7400 (rossz visszaváltás) | a henger kiesik (gyújtáskimaradás) |
| Motortörés | > 9000 1/perc | hajtókar átüti a blokkot – a motor halott |
| Hajtókar-csapágy | határolón tartás, hideg motor pörgetése, túlforró olaj | kopogás, olajnyomás esik, végül beragad |
| Hengerfej-tömítés | túlmelegedés > 120 °C | fogy a hűtőfolyadék, fehér füst, 132 °C-nál beragad |
| Dugattyú (LSPI) | padlógáz < 1800 1/perc magas fokozatban | megreped, gyújtáskimaradás, kék füst |
| Turbó | forró leállítás, hideg olaj + töltőnyomás | kevesebb töltőnyomás, füst |
| Kuplung | csúsztatás (pl. behúzott kézifék ellen) | égett szag, csúszik |

A „Vissza a startra” gomb csak az autót és az állapotot állítja vissza – a károk megmaradnak.

## Hang (src/lib/audio.ts)

AudioWorklet-alapú valós idejű szintézis: a worklet mintánként számolja a főtengely szögét, minden
gyújtásnál (1-3-4-2) kipufogó-impulzust indít a kipufogórendszer rezonanciáin (gyújtáskimaradás
hallható). Továbbá: szívózaj, turbósípolás, diverter-szelep, durrogás túlfutáskor (Race módban
gyakrabban), önindító, csapágykopogás, LSPI-kopogás, váltócsikorgás, motortörés, gördülési és
szélzaj, EPB motor, index relé, kürt, gong. Belső nézetben tompított hang + „Soundaktor” mélyhang.

## 3D (src/components/three)

Méter egység, +X előre, +Z jobbra, origó a tengelytáv közepe alatt.

- `shape.ts`, `bodyShader.ts` – paraméteres karosszéria (valós méretek: 4277 × 1799 × ~1440 mm,
  tengelytáv 2630 mm); a shader objektumtérben dönti el, mi festék (Lapiz Blue), üveg, lámpa, rács,
  illesztés – élesek a határvonalak; nyíló ajtók, motorháztető, csomagtérajtó; működő lámpák
  (DRL, tompított, féklámpa, dinamikus index, tolatólámpa)
- `Interior.tsx`, `screens.ts` – műszerfal, élő Active Info Display és Performance Monitor,
  kormány, pedálok, húzható váltókar, Start/Stop, EPB, Auto Hold, sportülések, öv
- `Powertrain.tsx`, `engineGeom.ts` – keresztben beépített, 12°-kal döntött EA888: dugattyúk,
  hajtókarok, szelepek, vezérműtengelyek, kiegyensúlyozó tengelyek, vezérműlánc, ékszíj, IS38 turbó
  forgó kerekekkel; váltó 7 fogaskerékpárral (a kapcsolt zölden, a tönkrement pirosan), PTU, kardán,
  Haldex, hátsó diffi; hűtő, intercooler, akku, tank
- `Chassis.tsx` – 19"-os felnik, gumik, féktárcsák (izzanak), nyergek, McPherson / többlengőkaros futómű
- `Exhaust.tsx` – turbó → kat + OPF → dobok → 4 végcső, füst és lángnyelvek
- `fitcheck.ts` – illeszkedés-ellenőrzés (lásd Tesztek)
