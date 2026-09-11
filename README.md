# BMW M52B28 motor- és járműszimuláció

BMW M52B28 (2.8 l soros hathengeres, DOHC 24 szelep, VANOS, 193 LE / 280 Nm) élő fizikai
szimulációja E36 328i hajtáslánccal (ZF 5 fokozat, 2.93 diffi, hátsókerék-hajtás), Next.js-ben,
teljes 3D autóval (three.js / react-three-fiber).

## Indítás

```bash
npm install
npm run dev
```

Majd nyisd meg: http://localhost:3000

## Tesztek

```bash
npm test
```

## Vezérlés

| Billentyű | Funkció |
|-----------|---------|
| I | gyújtás be/ki |
| K (tartva) | önindító |
| W / ↑ | gáz |
| S / ↓ | fék |
| Space (tartva) | kuplung benyomva; felengedés lassú = félkuplung |
| 1–5, N/0 | fokozat; Q/E le/fel |

A 3D nézet egérrel forgatható, görgővel nagyítható, jobb gombbal mozgatható.
A fejlécben nézet-előbeállítások (Teljes autó, Motor, Hengerek, Hajtáslánc, Fék / hátsó),
felirat-kapcsoló és időlassítás (1× … 1/100) található.

## Fizika (src/lib/engine.ts)

Fix 0,5 ms-os időlépés (2000 lépés/s), főtengely-dinamika nyomatékgörbével, súrlódással és
hengerenkénti nyomaték-lüktetéssel.

- **Motor:** 2793 cm³, 84 × 84 mm, hajtókar 135 mm, 10,2:1, gyújtási sorrend 1-5-3-6-2-4,
  280 Nm @ 3950 / 142 kW @ 5300, alapjárat 700 (hidegen 1000), határoló 6500 (üzemanyag-lezárás),
  lefulladás 350 alatt, betolásos indítás
- **ECU / befecskendezés (multipoint EFI):** MAP, levegő tömegáram, töltési fok, szívólevegő-hőmérséklet,
  AFR-szabályzás (λ=1 melegen, hidegindítási és teljes terhelésű dúsítás), injektor nyitási idő
- **Hőháztartás:** hűtővíz (termosztát 84–92 °C, elektromos ventilátor 97 °C-tól, vízpumpa a motorról jár),
  külön olaj-, hengerfej-, kipufogógáz- és katalizátor-hőmérséklet; leállított motor órák alatt hűl le;
  108 °C felett nyomaték-visszavétel, 128 °C-nál a motor beragad
- **Elektromos rendszer:** 60 Ah akkumulátor (töltöttség, belső ellenállás hidegen és lemerülve nő),
  önindító 170 A (lemerült akkuval nem forgat), ékszíjas generátor 2,6:1 áttétellel (max 90 A,
  14,2 V-os szabályzó, terhelő nyomaték a motoron), fogyasztók, töltés-lámpa
- **Hajtáslánc:** csúszó/kapcsolt kuplung, ZF S5D 320Z (4,21 / 2,49 / 1,66 / 1,24 / 1,00),
  2,93 differenciálmű, 225/50 R16, 1420 kg jármű légellenállással és gördülési ellenállással
- **Fékek:** első/hátsó féktárcsa-hőmérséklet a fékezési energiából, menetszél- és sugárzási hűtés,
  fading 450 °C felett, fékfolyadék forrása 230 °C felett
- **Kipufogórendszer:** 2 × 3-1 leömlő → 2 katalizátor (begyújtás 250 °C felett) → középső és hátsó dob →
  végcső; izzás terheléskor, füst-részecskék (hidegen fehér pára)
- **Időlassítás** 1× … 1/100 (a pedálok valós időben, a fizika lassítva)

## 3D jelenet (src/components/Engine3D.tsx)

1 egység = 10 cm, +X hátrafelé. Teljes autó:

- **Motor:** 6 henger 4-4 szeleppel, coil-on-plug tekercsek, injektorok porlasztási kúppal,
  2 vezérműtengely bütykökkel, 6 forgattyús főtengely ellensúlyokkal, vezérműlánc + VANOS,
  ékszíj (generátor, vízpumpa + viszkó-ventilátor, szervószivattyú, klímakompresszor, feszítő),
  szívócső fojtószeleppel, légszűrő/MAF, hűtő elektromos ventilátorral, olajteknő, olajszűrő
- **Hajtáslánc:** kettős tömegű lendkerék, kuplung, önindító, harangház, ZF váltóház váltókarral,
  kétrészes kardántengely csuklókkal, differenciálmű, féltengelyek
- **Autó:** 4 kerék (gumi, felni, hőmérséklet szerint izzó féktárcsa, féknyereg, felfüggesztés),
  E36 karosszéria-váz ülésekkel és kormánnyal, üzemanyagtank a hátsó ülés alatt folyadékszinttel,
  akkumulátor a csomagtartóban, teljes kipufogórendszer füsttel
- Élő feliratok a hőmérsékletekkel és mérőértékekkel (kapcsolhatók; a Teljes autó nézetben csak a főbbek)
