# 🌙 Notte — Dark Mode

Estensione **gratuita** che rende scuri i siti troppo chiari, per **Chrome,
Firefox e Safari** (iPhone, iPad e Mac). Interruttore per singolo sito, regolazione
di luminosità e contrasto, foto e video lasciati a colori naturali.

Nata come strumento di accessibilità **per la comunità ipovedente** — gratis per
sempre, senza pubblicità, senza donazioni, senza tracciamento.

## Com'è organizzata
```
chrome/    Versione pronta per Chrome / Edge / Brave
firefox/   Versione per Firefox (con l'id richiesto da AMO)
safari/    Stesso codice, da avvolgere con Xcode per Safari (iOS + Mac)
tools/sync.sh   Copia i file condivisi da chrome/ verso firefox/ e safari/
```
Le tre cartelle condividono `content.js`, `popup.*` e `images/` identici: cambia
solo il `manifest.json`. Se modifichi qualcosa, fallo in `chrome/` e poi lancia
`tools/sync.sh` per aggiornare le altre due.

## Come si prova / installa

### Chrome (anche Edge e Brave)
1. Apri `chrome://extensions`, attiva **Modalità sviluppatore** (in alto a destra).
2. **Carica estensione non pacchettizzata** → scegli la cartella `chrome/`.
Per pubblicarla: comprimi `chrome/` in zip e caricala sul Chrome Web Store
(quota di **5 $ una tantum**).

### Firefox
1. Apri `about:debugging` → **Questo Firefox** → **Carica componente temporaneo** →
   seleziona un file qualsiasi dentro `firefox/`.
Per pubblicarla: carica la cartella `firefox/` su addons.mozilla.org (**gratis**).

### Safari (iPhone, iPad, Mac) — serve un Mac con Xcode
Nel Terminale (trascina la cartella `safari` per ottenere il percorso):
```bash
xcrun safari-web-extension-converter /percorso/della/safari \
  --app-name "Notte" --bundle-identifier com.tuonome.notte \
  --project-location ~/Desktop
```
(Solo iPhone/iPad? aggiungi `--ios-only`; senza, fa anche Safari per Mac.)
Poi in Xcode: **Signing & Capabilities → Team** = il tuo account, premi **▶︎ Run**
sull'iPhone, e attiva l'estensione in **Impostazioni → Safari → Estensioni →
Notte**. Per pubblicarla: **Product → Archive → Distribute → App Store Connect**.

## Come funziona
Notte applica un filtro `invert + hue-rotate` alla pagina: metodo affidabile che
funziona su qualunque sito senza romperne il layout. Foto e video vengono
ri-invertiti così restano a colori naturali (opzione disattivabile).

💙 Fatta per gli eternauti ipovedenti. Buona luce (bassa).
