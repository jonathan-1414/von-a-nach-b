# Von A nach B

Pebble-App für die **Pebble Time 2** (Plattform `emery`). Sie zeigt für gespeicherte Bahnverbindungen
die nächsten drei Abfahrten mit Echtzeitdaten: Abfahrtszeit, Verspätung, Linie und Gleis.
Die Fahrplandaten kommen von [Transitous](https://transitous.org).

## Bedienung

- **Einstellungen** (in der Pebble-App auf dem Handy): bis zu 10 Verbindungen als Freitext eintragen,
  z. B. „Köln Hbf“ → „Köln Mülheim“. Nach dem Speichern steht dort, welche Haltestellen gefunden
  wurden. Es werden nur Verbindungen **ohne Umstieg** gesucht.
- **Liste** (Uhr): Hoch/Runter wählt eine Verbindung, die mittlere Taste öffnet sie.
- **Detailansicht**: die nächsten drei Abfahrten. Die mittlere Taste aktualisiert, Zurück führt zur Liste.

Die Zeile mit Linie und Gleis ist nach Verkehrsart eingefärbt:
S-Bahn grün, Bus violett, U-Bahn blau, Tram gelb, andere Züge rot.

## Wie es funktioniert

Die Uhr zeigt nur an, alle Netzwerkzugriffe macht das Handy.

1. **Speichern der Einstellungen:** Das Handy sucht Start und Ziel über die Transitous-API (`geocode`),
   merkt sich die Haltestellen und schickt die Namen der Verbindungen an die Uhr.
   Die Uhr speichert sie, damit die Liste auch ohne Handy sofort erscheint.
2. **Auswahl einer Verbindung:** Die Uhr fragt beim Handy an. Das Handy ruft Transitous (`plan`) ab
   und schickt ein kleines Paket mit den drei nächsten Abfahrten zurück.
3. **Fehler** werden auf der Uhr angezeigt: kein Handy verbunden, kein Netz, keine Verbindung gefunden.

| Teil | Technik | Ort |
|---|---|---|
| Uhr | Alloy (JavaScript, Moddable SDK), Oberfläche mit Piu | `src/embeddedjs/main.js` |
| Handy | PebbleKit JS | `src/pkjs/index.js` |
| Einstellungen | Clay | `src/pkjs/config.js` |

## Bauen und testen

```sh
pebble build
pebble install --emulator emery --logs     # im Emulator
pebble emu-app-config --emulator emery     # Einstellungen im Emulator öffnen
pebble install --phone <IP> --logs         # auf die Uhr (Entwicklerverbindung in der Pebble-App)
```

**Hinweis:** Die Namensliste kommt nur auf der Uhr an, wenn die App beim Speichern
der Einstellungen auf der Uhr geöffnet ist.
