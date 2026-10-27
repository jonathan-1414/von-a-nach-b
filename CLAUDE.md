# Von A nach B

Pebble-App für die **Pebble Time 2** (Plattform `emery`). Sie zeigt für gespeicherte Bahnverbindungen
die nächsten Abfahrten mit Echtzeitdaten an. Datenquelle ist die **Transitous-API**.

## Zusammenarbeit

- Antworte auf Deutsch.
- Ich habe wenig Programmiererfahrung (vor allem Python-Skripte). Erkläre neue Konzepte kurz und
  arbeite in kleinen, testbaren Schritten.
- Ändere nur, worum ich bitte. Größere Umbauten oder Abweichungen vom Bauplan erst vorschlagen.
- Wenn du dir bei einer Pebble- oder Alloy-API unsicher bist, prüfe die Doku, statt zu raten:
  https://developer.repebble.com/guides/alloy/

## Technik

| Teil | Sprache / Werkzeug | Ort |
|---|---|---|
| Uhr | **Alloy** (JavaScript, Moddable SDK), UI mit Piu | Embedded-JS des Projekts |
| Handy | **PebbleKit JS** | `src/pkjs/index.js` |
| Einstellungen | **Clay** (Freitextfelder, keine Suchvorschläge) | pkjs |
| Daten | Transitous-API (`geocode`, `plan`) | https://api.transitous.org |

Test im Emulator `emery`, danach auf der echten Uhr über die Pebble-App (iPhone).

## Grundregel

Die Uhr zeigt nur an. Das Handy macht alle Netzwerkzugriffe, wertet das JSON aus und schickt der Uhr
nur ein kleines, fertiges Paket. Die vollständige Transitous-Antwort kommt nie auf die Uhr
(wenig Arbeitsspeicher, begrenzte AppMessage-Größe).

## Speicherung

- **Handy (localStorage von pkjs):** Start/Ziel-Eingaben, Haltestellen-IDs, aufgelöste Haltestellennamen.
- **Uhr (localStorage von Alloy):** nur die Anzeigenamen der Verbindungen, z. B. `Köln Hbf → Düsseldorf Hbf`.
  So erscheint das Menü sofort, auch ohne Handyverbindung.

## Abläufe

### 1. Einstellungen speichern (Handy)
1. Clay liefert bis zu 10 Paare (Start, Ziel) als Freitext.
2. Für jede Verbindung: Start und Ziel per Transitous `geocode` auflösen.
   - gefunden: IDs und aufgelöste Namen im localStorage speichern, Anzeigenamen bilden
   - nicht gefunden: Verbindung als „Haltestelle nicht gefunden“ markieren
3. Die aufgelösten Namen beim nächsten Öffnen der Einstellungen anzeigen, damit Fehltreffer auffallen.
4. Liste der Anzeigenamen per AppMessage an die Uhr senden. Die Uhr speichert sie und baut die Liste neu auf.

### 2. App öffnen (Uhr)
1. Anzeigenamen aus localStorage laden.
2. Verbindungen vorhanden: Liste (Piu) zeigen. Sonst Hinweis „Verbindungen in den Einstellungen anlegen“.

### 3a. Verbindung auswählen (Uhr)
1. Ladeanzeige zeigen.
2. Handy verbunden: `message.write()` mit `{ REQUEST: i }`, Timeout starten (z. B. 15 s).
   Sonst Fehler „Keine Verbindung zum Handy“.

### 3b. Fahrplan abfragen (Handy)
1. IDs zu Verbindung i aus localStorage lesen.
2. Transitous `plan`: fromPlace, toPlace, Zeit = jetzt, ohne Umstieg.
3. Eigenen User-Agent setzen: `xhr.setRequestHeader('User-Agent', 'VonAnachB/0.1 (Pebble)')`.
   Die aktuelle Pebble-App gibt gesetzte Header ungefiltert weiter.
4. Antwort ok und Verbindungen vorhanden: für die ersten 3 Verbindungen Abfahrt Soll/Ist,
   Linie, Gleis auslesen, Verspätung in Minuten berechnen, kompaktes Paket an die Uhr senden.
5. Keine Verbindungen: Code „keine Verbindung gefunden“. HTTP-/Netzfehler: Code „kein Netz / API-Fehler“.

### 3c. Ergebnis anzeigen (Uhr, `onReadable()`)
1. Timeout stoppen, Ladeanzeige ausblenden.
2. Fehlercode: passende Meldung. Sonst je Verbindung eine Zeile: Abfahrt, Linie, Gleis,
   Verspätung (z. B. `+3`).
3. **Keine** Anzeige „in X min“.
4. Idee, noch offen: mittlere Taste (Select) in der geöffneten Verbindung = Aktualisieren (erneut 3a).

## Fehlerzustände

- kein Handy verbunden
- kein Netz / API-Fehler (auch: Internet-Berechtigung in der Pebble-App abgelehnt)
- keine Verbindung gefunden
- Haltestelle nicht gefunden (beim Speichern)

## Noch festzulegen

- AppMessage-Keys und Format des kompakten Pakets (bei der Umsetzung entscheiden).

## Empfohlene Reihenfolge

1. Handy → Transitous → Ausgabe in der Konsole (fest eingetragene Haltestelle).
2. Clay-Einstellungen mit Geocode-Auflösung.
3. Nachrichten Uhr ↔ Handy.
4. Uhr-Oberfläche (Liste, Detailansicht, Fehlermeldungen).
