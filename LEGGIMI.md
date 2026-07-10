# 🌙 Notte — Dark Mode (estensione Safari per iPhone)

Estensione Safari che rende scuri i siti troppo chiari. Funziona su iPhone e iPad
(e anche su Safari per Mac). Puoi accenderla/spegnerla per singolo sito e regolare
luminosità e contrasto.

Questa cartella contiene **l'estensione web** completa. Per farla diventare un'app
installabile su iPhone serve un passaggio in **Xcode** (su un Mac), spiegato sotto.
Non serve scrivere altro codice: Xcode fa quasi tutto da solo.

---

## Cosa c'è dentro

```
Notte-DarkMode/
├─ manifest.json     → configurazione dell'estensione
├─ content.js        → applica la modalità scura alle pagine
├─ popup.html        → il pannello con gli interruttori
├─ popup.js          → logica del pannello
└─ images/           → icone (48…512 px)
```

---

## Cosa ti serve

- Un **Mac** con **Xcode** installato (gratis dall'App Store).
- Il tuo **account Apple Developer** (che hai già ✅).
- Un **iPhone** per provarla (opzionale: c'è anche il simulatore).

---

## Passo 1 — Trasforma l'estensione in un progetto Xcode

Apri l'app **Terminale** sul Mac e incolla questo comando, sostituendo il percorso
con quello della cartella `Notte-DarkMode` (puoi trascinare la cartella nel Terminale
per far comparire il percorso):

```bash
xcrun safari-web-extension-converter /percorso/della/Notte-DarkMode \
  --app-name "Notte" \
  --bundle-identifier com.tuonome.notte \
  --project-location ~/Desktop \
  --ios-only
```

- Cambia `com.tuonome.notte` in un identificativo tuo e unico (es. `com.mario.notte`).
- Al termine si aprirà automaticamente il progetto in Xcode.

> Se preferisci non usare il Terminale: in Xcode scegli
> **File → New → Project → Safari Extension App**, poi sostituisci i file generati
> in `Resources/` con quelli di questa cartella.

---

## Passo 2 — Firma e prova sul tuo iPhone

1. In Xcode, in alto, seleziona il target che finisce con **(iOS)**.
2. Vai su **Signing & Capabilities** → alla voce **Team** scegli il tuo account Developer.
3. Collega l'iPhone col cavo, selezionalo come dispositivo in alto, premi **▶︎ (Run)**.
4. Sull'iPhone apri **Impostazioni → App → Safari → Estensioni** (o
   **Impostazioni → Safari → Estensioni**) → attiva **Notte**.
5. Alla richiesta dei permessi, scegli **Consenti** e **Consenti su tutti i siti**
   (serve perché possa oscurare qualsiasi pagina).
6. Apri Safari, tocca il pulsante **ᴀA** (o il pezzo dell'estensione) nella barra
   indirizzi → **Notte** → et voilà: compare il pannello con gli interruttori.

---

## Passo 3 — Pubblicarla sull'App Store (per tutti, gratis per chi la scarica)

1. In Xcode: menu **Product → Archive**.
2. Nella finestra Organizer premi **Distribute App → App Store Connect → Upload**.
3. Vai su [App Store Connect](https://appstoreconnect.apple.com) → **My Apps → +**
   e crea la scheda dell'app (nome, categoria, descrizione, privacy).
4. Carica un paio di **schermate**, associa la build appena caricata e premi
   **Submit for Review**.
5. La revisione di Apple richiede in genere **1–3 giorni**.

Nota: l'account Developer (99 $/anno) lo paghi tu una volta; **chi scarica l'app
non paga nulla** se la pubblichi come gratuita.

---

## Come funziona (in breve)

Notte applica un filtro `invert + hue-rotate` alla pagina: è il metodo più
**affidabile** perché funziona su qualunque sito senza romperne il layout. Le foto e
i video vengono ri-invertiti così restano a colori naturali (puoi disattivarlo).
Se un sito ha già una sua dark mode e non vuoi lo scuro doppio, basta spegnere Notte
solo su quel sito con l'interruttore **"Scuro su questo sito"**.

## Idee per migliorarla in futuro

- Aggiungere una modalità "scuro dinamico" (colori reali invece dell'inversione).
- Pianificazione automatica (attiva solo la sera).
- Sincronizzazione delle eccezioni tra i tuoi dispositivi via iCloud.

Se vuoi, posso implementarne una di queste: dimmi quale.
