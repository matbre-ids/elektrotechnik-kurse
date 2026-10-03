# E-Learning Elektrotechnik – Einheitenvorsätze

Ein etwa 30-minütiger Kurs für Berufsschüler. Er verbindet kurze Lernschritte, adaptive Übungen und fünf Papierstationen auf einem persönlichen A4-Arbeitsblatt. Der Kurs kommt ohne Installation, Benutzerkonto, Datenbank oder Backend aus und läuft auf jedem statischen Webserver, auch auf GitHub Pages.

| Datei | Zweck |
|---|---|
| `index.html` + `app.js` + `styles.css` | Schülerkurs (Start über den QR-Code des Arbeitsblatts) |
| `lehrer.html` + `lehrer.js` + `arbeitsblatt.css` | Lehrerwerkzeug: Namensliste → IDs, Zugangscodes, QR-Codes, A4-Blätter |
| `pruefen.html` + `pruefen.js` | Lehrer-Prüfseite für Abschlusscodes |
| `kurse/einheitenvorsaetze.js` | Kursinhalt: Lernschritte, Aufgabenpools, Fehlertypen, Papierstationen, Check |
| `lib/core.js` | Grundfunktionen (Seed-Zufall, Zahlenformat, Vorsätze, Kursregister) |
| `lib/qrcode.js` | QR-Code-Erzeugung (eigene Implementierung, ohne externe Bibliothek) |
| `lib/abschlusscode.js` | Abschlusscode erzeugen und dekodieren |
| `test/autoplay.js` | nur für Tests: spielt den Kurs automatisch durch |

Alle Pfade sind relativ. Der Ordner funktioniert deshalb unverändert auf GitHub Pages und auf einem eigenen Webserver.

---

## 1. Lokal testen

Die Seiten brauchen einen kleinen lokalen Webserver. Ein Doppelklick auf die HTML-Datei (`file://`) reicht nicht, weil manche Browser dann den Speicher sperren.

```bash
python -m http.server 8000
```

Den Befehl im Ordner `E-Learning` ausführen. Danach im Browser öffnen:

- Lehrerwerkzeug: <http://localhost:8000/lehrer.html>
- Testschüler: <http://localhost:8000/index.html?k=ev&id=001&seed=K8M2>
- Prüfseite: <http://localhost:8000/pruefen.html>

QR-Codes mit `localhost` funktionieren nur auf dem eigenen Rechner. Für den Unterricht im Lehrerwerkzeug die Online-Adresse eintragen.

## 2. Auf einen Webserver hochladen

Den kompletten Ordner `E-Learning` per FTP oder SFTP in ein Verzeichnis hochladen, zum Beispiel `https://meine-schule.de/einheiten/`. Mehr ist nicht nötig. Es gibt keine Datenbank, kein PHP und keine Konfiguration. Der Unterordner `.claude` wird nicht gebraucht und kann wegbleiben.

## 3. GitHub Pages

1. Neues Repository anlegen, zum Beispiel `elektrotechnik-kurse`.
2. Den **Inhalt** des Ordners `E-Learning` hochladen, also `index.html` direkt auf oberster Ebene.
3. *Settings → Pages → Build and deployment*: „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.
4. Nach ein bis zwei Minuten ist der Kurs unter `https://<benutzername>.github.io/elektrotechnik-kurse/` erreichbar.
5. Diese Adresse plus `index.html` im Lehrerwerkzeug als „Adresse des Schülerkurses“ eintragen.

Nach Änderungen kann GitHub Pages bis zu zehn Minuten lang die alte Version ausliefern (Cache).

## 4. Namensliste importieren und Schülerblätter erzeugen

1. `lehrer.html` öffnen.
2. Kurs wählen, Klasse und optional das Datum eintragen. Die **Adresse des Schülerkurses** prüfen: Sie ist mit der aktuellen Adresse vorbelegt.
3. Namen eintragen, einen pro Zeile, oder eine CSV-Datei laden. Diese Formate werden erkannt:
   ```
   Anna Müller
   Ben Schneider
   ```
   ```
   001;Anna Müller
   002;Ben Schneider
   ```
   Semikolon, Komma und Tabulator gehen als Trennzeichen. Eine Kopfzeile wie `Name;Vorname` wird übersprungen. Ohne eigene Nummern vergibt das Werkzeug Blatt-Nummern ab der „Ersten Blatt-Nr.“. Für eine zweite Klasse bietet sich zum Beispiel 101 an, damit sich die Nummern nicht überschneiden. Erlaubt sind 1 bis 999.
4. **Blätter erzeugen** klicken. Jeder Schüler bekommt:
   - eine Blatt-Nr. (interne ID, zum Beispiel `017`),
   - einen zufälligen Zugangscode (Seed, zum Beispiel `K8M2`, erzeugt mit `crypto.getRandomValues`),
   - einen QR-Code,
   - ein personalisiertes A4-Blatt mit eigenen Zahlen an allen fünf Papierstationen.
5. **Liste mit Codes speichern (CSV)** und die Datei aufbewahren. Sie ordnet Blatt-Nr., Name und Zugangscode einander zu. Lädt man diese Datei später wieder, bleiben die Zugangscodes erhalten. Ein Nachdruck ergibt dann identische Blätter.
6. **Alle Blätter drucken**: Jedes Blatt kommt auf eine eigene A4-Seite, mit Seitenumbruch nach jedem Schüler. Im Druckdialog „Hintergrundgrafiken“ aktivieren, damit die Rechenkästchen erscheinen. Die Blätter sind für Schwarz-Weiß-Drucker ausgelegt.
7. Optional: **Klassenliste drucken** (Name, Blatt-Nr., Zugangscode, Feld für den Abschlusscode).

## 5. So funktionieren die QR-Codes (Datenschutz)

Der QR-Code enthält nur neutrale technische Angaben:

```
https://…/index.html?k=ev&id=017&seed=K8M2
```

- `k` = Kurskennung, `id` = Blatt-Nr., `seed` = Zugangscode
- **Kein Name** steht im QR-Code, in der URL, in der Browserhistorie oder im Server-Log. Die Zuordnung `017 → Anna Müller` gibt es nur auf dem Ausdruck und in der CSV-Liste der Lehrkraft.

Der Seed legt die Aufgabenvariante fest. Startet ein Schüler mit derselben ID und demselben Seed neu, bekommt er dieselben Grundaufgaben und Papierstationen. Adaptive Wiederholungen und Kurzchecks kommen zusätzlich dazu.

Ohne QR-Scanner öffnen die Schüler die Kursadresse und geben Blatt-Nr. und Zugangscode vom Blatt ein.

**Fortschritt:** Der Fortschritt wird pro Blatt im `localStorage` des Schülergeräts gespeichert. Ein Neuladen schadet nicht. Ein Neustart geht nur bewusst über „Übersicht → Kurs neu starten“. Nichts verlässt das Gerät. Gespeichert werden unter anderem: gestellte Aufgaben, beim ersten Versuch richtige Aufgaben, falsche Antworten, Ergebnisse des ersten und des letzten Checks, Wiederholungen, korrigierte Fehlertypen, Papierstationen, Abschlussstatus und Abschlusscode. Wechselt ein Schüler das Gerät, beginnt der Kurs dort von vorn.

## 6. Kursablauf (Kurs „Einheitenvorsätze“, Kennung `ev`)

7 Schritte: 6 Lernschritte und am Ende der Kompetenzcheck. In die Lernschritte 2 bis 6 ist am Ende jeweils eine Papierstation eingebaut: 1 einfache Umrechnung, 2 Vorsatzleiter ausfüllen, 3 gleiche Werte mit Linien **verbinden** (Zuordnung danach am Bildschirm übertragen), 4 Zehnerpotenz und Taschenrechner, 5 Abschlussaufgabe U = R · I. Jeder Schritt folgt dem Muster: kurze Erklärung → Beispiel → Pflichtaufgaben → sofortiges Feedback. „Weiter“ ist erst aktiv, wenn alle Aufgaben des Schritts bearbeitet sind, auch die Papierstation.

- **Feedback bei Fehlern:** erkennt typische Fehler (falsche Richtung, Komma um 1 oder 2 statt 3 Stellen verschoben, falsche Stufenzahl, M/m verwechselt, Vorsatz in der Formel nicht umgerechnet) und zeigt den Lösungsweg.
- **Adaptive Wiederholung:** Jede falsche Antwort merkt sich ihren Fehlertyp, zum Beispiel „µA ↔ mA“. Frühestens einen Bildschirm später kommt eine neue Aufgabe desselben Typs mit anderen Zahlen. Die identische Aufgabe erscheint nicht noch einmal. Ein Fehlertyp ist erst behoben, wenn später eine vergleichbare Aufgabe richtig gelöst wurde. War der Typ **mehrfach falsch**, braucht es **zwei richtige Aufgaben in Folge**; jede weitere falsche Antwort setzt das zurück. Pro Fehlertyp gibt es **höchstens 3 Wiederholungsaufgaben**. Danach geht es ohne weiteres Nachüben dieses Typs weiter; die Zahl lässt sich in `kurse/einheitenvorsaetze.js` über `maxWiederholungen` ändern. Vor dem Kompetenzcheck werden alle offenen Typen nachgearbeitet.
- **Papierstationen:** Die Aufgabe steht mit den individuellen Zahlen auf dem Blatt. Am Bildschirm wird nur das Ergebnis eingegeben, nachdem der Schüler bestätigt hat, dass der Rechenweg auf dem Blatt steht. Bei einem Fehler gibt es einen Hinweis und einen neuen Versuch, ab dem zweiten Fehlversuch zusätzlich den Lösungsweg. Eine Station lässt sich nicht überspringen.
- **Kompetenzcheck:** 10 Aufgaben. Abgedeckt sind Vorsatz erkennen, M/m, einfache Umrechnungen, µ ↔ m, n ↔ µ, mehrere Stufen, sinnvolle Schreibweise, Zehnerpotenz und U = R · I. Bestanden ist der Check ab 80 %. Unter 80 % erscheint „Fast geschafft“ mit den Bereichen zum Üben. Danach folgen gezielte Übungsaufgaben und ein neuer Kurzcheck mit 5 Aufgaben, ähnlich, aber mit anderen Zahlen. Das wiederholt sich, bis der Check bestanden ist.
- **Grüner Erfolgsbildschirm** nur, wenn alle Lernschritte und alle 5 Papierstationen erledigt sind, der Check bestanden ist und keine Fehlertypen mehr offen sind.

## 7. Abschlusscodes prüfen

Am Ende sieht der Schüler einen Code im Format `XXXX-XXXX`, zum Beispiel `K7M4-8R3X`. Er überträgt ihn auf sein Blatt. 
Auf `pruefen.html` den Code eingeben. Auf den Schülerseiten gibt es keinen Link zur Prüfseite. Die Seite zeigt:
Kurs, Arbeitsblatt-ID, ersten Kompetenzcheck, erfolgreichen Abschlusscheck, Wiederholungsaufgaben, Papierstationen, Status und Zufallskennung.

- **Abgleich mit dem Papierblatt:** Die Blatt-Nr. vom Arbeitsblatt in das zweite Feld eintragen. Die Seite meldet, ob der Code zu diesem Blatt gehört.
- **Namen anzeigen (optional):** die gespeicherte CSV-Klassenliste laden. Sie wird nur im Browser gelesen.
- Falsch abgeschriebene Codes werden erkannt: Eine Prüfsumme fängt etwa 99 % der Tippfehler ab. In den Codes kommen die Zeichen 0, O, 1 und I nicht vor.

Aufbau des Codes (40 Bit, Alphabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`):
Blatt-ID (10 Bit) · erster Check in 10er-Schritten (4 Bit) · letzter Check 80/90/100 % (2 Bit) · Wiederholungen 0–31 (5 Bit) · Zufallsanteil 0–9999 (14 Bit, `crypto.getRandomValues`) · Prüfsumme (5 Bit). Alles wird kursabhängig verwürfelt. Der Code ist ein Plausibilitätsnachweis, keine kryptografische Signatur: Wer den Quelltext kennt, könnte Codes nachbauen.

## Passwortschutz der Lehrerseiten

`lehrer.html` und `pruefen.html` fragen beim Öffnen nach einem Passwort. Die Freigabe gilt, bis der Browser-Tab geschlossen wird.
Das Passwort steht nicht im Klartext im Code, sondern nur als PBKDF2-Prüfwert in `lib/zugang.js`.

**Grenzen:** Auf GitHub Pages gibt es keinen Server. Die Sperre hält Schüler zuverlässig fern, wer aber gezielt den öffentlichen Quelltext untersucht, kann sie umgehen. Auf den Lehrerseiten sind keine Schülerdaten gespeichert, deshalb ist das hier vertretbar.

**Passwort ändern:**
1. Lehrerseite öffnen und entsperren.
2. Mit F12 die Browserkonsole öffnen und eingeben:
   ```js
   await ET.Zugang.neuerPruefwert('neues Passwort')
   ```
3. Die drei ausgegebenen Zeilen (`salz`, `runden`, `pruefwert`) in `lib/zugang.js` im Block `ZUGANG` ersetzen, dann hochladen.

## Feedback der Schüler

Nach dem bestandenen Kompetenzcheck und vor dem grünen Abschluss fragt der Kurs nach Feedback: „Wie hilfreich war der Kurs? (1–5)“ und „Was war gut, was sollte verbessert werden?“. Beantwortet wird auf dem Arbeitsblatt im Feld „Feedback zum Kurs“. Die Schüler bestätigen das per Häkchen; erst dann erscheint der Abschlussbildschirm. Am Bildschirm wird nichts gespeichert oder übertragen.

## 8. Aufgaben ändern oder ergänzen

Alles Inhaltliche steht in `kurse/einheitenvorsaetze.js`:

- **Zahlenpools:** In jedem Generator (`gen.xyz = function (r) { … }`) stehen die erlaubten Werte als Liste, zum Beispiel `r.pick([2.2, 3.3, 4.7])`. Werte hinzufügen oder entfernen genügt. Die Musterlösung wird automatisch berechnet.
- **Neuer Generator:** gibt ein Objekt zurück, mit
  - `kind`: `'mc'` (Auswahl), `'num'` (Zahlenfeld(er)), `'eng'` (Zahl + Vorsatz wählen), `'match'` (Zuordnung) oder `'ladder'` (Stufenleiter),
  - `err`: Fehlertyp für die Wiederholung, Schlüssel aus `fehler`,
  - `q`: Frage, `explain`: Lösungsweg, bei `num` zusätzlich `fields: [{ pre, post, answer }]`,
  - bei MC: `options: [{ t, ok: true }, { t, why: 'Erklärung des typischen Fehlers' }]`,
  - bei Papierstationen zusätzlich `sheet`: der Aufgabentext für den Ausdruck.
- **Lernschritt:** Eintrag in `schritte` mit `titel`, `html` (kurze Erklärung) und `tasks: ['generatorname', …]`.
- **Fehlertyp:** Eintrag in `fehler` mit `label`, `tipp` und `gen` (Generatoren für neue Aufgaben dieses Typs).

Nach Änderungen einmal komplett durchspielen. Für einen schnellen Test öffnet man den Kurs, holt in der Browserkonsole `test/autoplay.js` dazu und ruft `autoplay()` auf.

## 9. Neuen Kurs hinzufügen (z. B. Ohmsches Gesetz)

Die Plattform trennt allgemeine Lernlogik (`app.js`), Teilnehmer- und QR-Logik (`lib/core.js`, `lehrer.js`), Abschlusscode (`lib/abschlusscode.js`) und Kursinhalt (`kurse/*.js`).

1. `kurse/einheitenvorsaetze.js` kopieren, zum Beispiel nach `kurse/ohmsches-gesetz.js`.
2. Unten bei `ET.registerKurs({ … })` eine **neue, kurze Kennung** vergeben, zum Beispiel `id: 'og'`, und Titel, Schritte, Generatoren, Fehlertypen, Papierstationen und Check anpassen.
3. Die neue Datei in **`index.html`, `lehrer.html` und `pruefen.html`** einbinden:
   ```html
   <script src="kurse/ohmsches-gesetz.js"></script>
   ```
4. Im Lehrerwerkzeug den neuen Kurs auswählen. Die QR-Codes enthalten dann `k=og`, und die Prüfseite erkennt die Codes beider Kurse.

Die Kurskennung eines laufenden Kurses danach nicht mehr ändern: Sie steckt in den QR-Codes und Abschlusscodes.
