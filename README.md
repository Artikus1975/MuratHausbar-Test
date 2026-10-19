# Hausbar Next v0.33

Korrektur nach v0.18: Die Datenanreicherung bleibt erhalten, aber die sichtbaren Inventar-Filter werden wieder auf kontrollierte, nutzerfreundliche Facetten begrenzt.

## Zweck dieser Version

- keine ausufernden Geschmacksfilter wie einzelne Botanicals, Früchte oder Detailnoten
- keine ausufernden Nutzungs- und Stilfilter
- Herkunftsfilter zeigt nur noch die Haupt-Herkunft, nicht Regionen/Orte/Dörfer
- detaillierte Tags bleiben intern für Suche, Beschreibung und spätere Intelligenz erhalten
- Inventar bleibt übersichtlich für den Nutzer

## Nicht geändert

- keine Änderung an der Grundlogik der App
- keine Änderung am Rauchig-Prinzip
- keine UI-Experimente
- keine neuen Daten-Enrichment-Batches
- keine Runtime-Hooks, keine Wrapper, kein Service Worker

## Upload

Für GitHub Pages den vollständigen Inhalt des freigegebenen App-Ordners `HausbarNext-main/` deployen. Keine Einzeldatei-Auswahl verwenden.

Zwingende Runtime-Dateien:

- `index.html`
- `style.css`
- `app.js`
- `APP_RELEASE_DATENBASIS_BLOCK_G_v4.20_v1.00.js`

Weitere Paketartefakte werden ebenfalls mit deployt. `inventar_aktuell_142.csv` ist ein Paketartefakt, aber keine Runtime-Abhängigkeit. `data.js` ist Legacy, wird von `index.html` nicht geladen und ist kein Fallback oder Ersatz für die Release-Daten-JS. Fehlt `APP_RELEASE_DATENBASIS_BLOCK_G_v4.20_v1.00.js`, muss die App fail-closed abbrechen.

Testlink:

https://artikus1975.github.io/HausbarNext/?v=033

## v0.21

Controlled Inventory Filter Taxonomy: sichtbare Inventarfilter sind auf kuratierte Hauptwerte begrenzt. Interne Detailtags bleiben erhalten, erscheinen aber nicht als Filteroptionen. Herkunftsfilter zeigt nur Länder.


## v0.21

- Inventar-Flaschendetails zeigen den Bereich „Servieren“ nicht mehr an.
- Servierdaten bleiben intern in den Daten erhalten.
- Keine Änderung an Filtern, Rezepten, Tagescocktail oder Datenanreicherung.

## v0.24

Basis: v0.21. Repariert Home-Rezeptlinks robust und bereinigt die Rezeptdetailansicht ohne Inventar-, Filter- oder Datenmigration.

Für GitHub Pages den vollständigen Inhalt aus `HausbarNext-main/` hochladen.


## v0.28

Korrekturkandidat auf Basis der unveränderten Stable v0.24: sichtbare Hausbar-Zuordnung je Rezeptzutat, transparente externe Prüfzutaten bei Empfehlungen, mindestens 44x44 Touch-Hitboxen, vollständige Safe-Area-Innenabstände und konsistente Versionskennung. Release-Datenbasis und Legacy-Daten bleiben unverändert.


## v0.29

Reine Provenienz-Umbasierung der Release-Datenbasis auf den autoritativen Rezeptmaster v4.07. Keine fachliche oder funktionale App-Aenderung gegenueber v0.28.
