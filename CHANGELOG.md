# Changelog

Alle Änderungen an „Von A nach B“. Jede Version hat ein gleichnamiges Git-Tag.

## v0.2.0 – 29.10.2026

### Neu
- Die Detailansicht zeigt jetzt die nächsten **fünf** Abfahrten statt drei, zwei pro Bildschirm.
  Mit Hoch/Runter wird geblättert, eine Laufleiste am rechten Rand zeigt die Position.
- Die aktuelle Uhrzeit steht oben rechts in der Detailansicht.
- Echtzeit ist erkennbar: Verspätung grün bis +4, rot ab +5 Minuten. Ohne Echtzeitdaten steht
  „lt. Fahrplan“.
- Die Liste der Verbindungen läuft rund: Nach der letzten geht es mit der ersten weiter.

### Geändert
- Größere Schrift: Die Liste zeigt drei Verbindungen mit Nummer, die Detailansicht einen Kopf mit
  Start und Ziel und darunter zwei Abfahrten.
- Vor dem Ziel steht » statt „nach“.
- Die 10. Verbindung trägt in der Liste die Nummer 0, damit die Nummernspalte schmal bleibt.
- Es werden nur Abfahrten in den nächsten 20 Stunden angezeigt.
- Fußwege vor und nach der Fahrt sind auf 5 Minuten begrenzt. So erscheinen keine Verbindungen
  mehr, bei denen man nach der Fahrt noch weit laufen muss.
- Mehr Arbeitsspeicher für JavaScript auf der Uhr (etwa 50 statt 32 kB).

### Behoben
- Absturz „output_begin failed“ beim Senden an die Uhr.

## v0.1.0 – 27.10.2026

Erste Version im Pebble Store.

- Bis zu 10 Verbindungen in den Einstellungen als Freitext eintragen. Die Haltestellen werden über
  Transitous gesucht, die gefundenen Namen stehen beim nächsten Öffnen der Einstellungen da.
- Liste der Verbindungen auf der Uhr, auch ohne Handyverbindung sofort sichtbar.
- Detailansicht mit den nächsten drei Direktverbindungen: Abfahrt, Verspätung, Linie und Gleis.
  Die Zeile mit Linie und Gleis ist nach Verkehrsart eingefärbt.
- Mittlere Taste in der Detailansicht aktualisiert.
- Fehlermeldungen: kein Handy verbunden, kein Netz / API-Fehler, keine Verbindung gefunden.
