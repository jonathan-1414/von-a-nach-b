// Handy-Teil (PebbleKit JS).
// Schritt 2: Einstellungen (Clay) speichern, Haltestellen per geocode auflösen.
// Zum Testen wird beim Start die erste gespeicherte Verbindung abgefragt
// und das Ergebnis in der Konsole ausgegeben.

var Clay = require('@rebble/clay');
var config = require('./config');

// autoHandleEvents: false = wir öffnen und schließen die Seite selbst,
// damit wir die Seite mit den gefundenen Namen bauen und nach dem
// Speichern die Haltestellen suchen können.
// Clay schaut beim Erzeugen nach, welche Bausteine (Eingabefeld, Text, ...)
// vorkommen. Deshalb hier schon eine vollständige Seite übergeben.
var clay = new Clay(config.baueConfig([]), null, { autoHandleEvents: false });

var API = 'https://api.transitous.org/api';
var USER_AGENT = 'VonAnachB/0.1 (Pebble)';

// Fehlercodes (später auch für die Uhr)
var FEHLER_KEINE_VERBINDUNG = 1;
var FEHLER_NETZ = 2;

// ---------- Speicher ----------
// "verbindungen" ist eine Liste mit 10 Plätzen (wie in den Einstellungen).
// Leerer Platz: null. Sonst:
// { start, ziel,                 Eingaben als Freitext
//   ok,                          true = beide Haltestellen gefunden
//   startId, startName, zielId, zielName }

function ladeVerbindungen() {
  try {
    return JSON.parse(localStorage.getItem('verbindungen')) || [];
  } catch (e) {
    return [];
  }
}

function speichereVerbindungen(liste) {
  localStorage.setItem('verbindungen', JSON.stringify(liste));
}

// Nur die gefundenen Verbindungen, mit Anzeigename (für die Uhr)
function anzeigeNamen() {
  return ladeVerbindungen()
    .filter(function (v) { return v && v.ok; })
    .map(function (v) { return v.startName + ' → ' + v.zielName; });
}

// ---------- Netzwerk ----------

// Holt eine URL und ruft danach callback(fehler, daten) auf.
function holeJson(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url);
  xhr.setRequestHeader('User-Agent', USER_AGENT);
  xhr.timeout = 10000;
  xhr.onload = function () {
    if (xhr.status !== 200) {
      callback('HTTP ' + xhr.status);
      return;
    }
    try {
      callback(null, JSON.parse(xhr.responseText));
    } catch (e) {
      callback('JSON kaputt: ' + e);
    }
  };
  xhr.onerror = function () { callback('Netzfehler'); };
  xhr.ontimeout = function () { callback('Zeitüberschreitung'); };
  xhr.send();
}

// Sucht eine Haltestelle. callback(fehler, treffer)
// treffer = { id, name } oder null, wenn nichts gefunden wurde.
function sucheHaltestelle(text, callback) {
  var url = API + '/v1/geocode?type=STOP&text=' + encodeURIComponent(text);
  holeJson(url, function (fehler, daten) {
    if (fehler) {
      callback(fehler);
      return;
    }
    if (!daten || daten.length === 0) {
      callback(null, null);
      return;
    }
    callback(null, { id: daten[0].id, name: daten[0].name });
  });
}

// ---------- Einstellungen ----------

Pebble.addEventListener('showConfiguration', function () {
  clay.config = config.baueConfig(ladeVerbindungen());
  Pebble.openURL(clay.generateUrl());
});

Pebble.addEventListener('webviewclosed', function (e) {
  if (!e || !e.response) {
    return; // abgebrochen
  }
  // Clay merkt sich die Eingaben selbst (für das nächste Öffnen).
  // Mit "false" bekommen wir { START_0: { value: '...' }, ... } zurück.
  var werte = clay.getSettings(e.response, false);

  var eingaben = [];
  for (var i = 0; i < config.ANZAHL; i++) {
    var start = ((werte['START_' + i] || {}).value || '').trim();
    var ziel = ((werte['ZIEL_' + i] || {}).value || '').trim();
    eingaben.push(start && ziel ? { start: start, ziel: ziel } : null);
  }

  loeseAuf(eingaben, function (liste) {
    speichereVerbindungen(liste);
    console.log('Gespeichert. Anzeigenamen für die Uhr:');
    console.log(JSON.stringify(anzeigeNamen()));
    // Schritt 3: hier die Anzeigenamen an die Uhr senden
  });
});

// Löst alle Eingaben nacheinander auf (eine Anfrage nach der anderen,
// um die API zu schonen). Unveränderte, schon gefundene Verbindungen
// werden aus dem Speicher übernommen statt neu gesucht.
function loeseAuf(eingaben, fertig) {
  var alt = ladeVerbindungen();
  var ergebnis = [];

  function naechste(i) {
    if (i >= eingaben.length) {
      fertig(ergebnis);
      return;
    }
    var ein = eingaben[i];
    if (!ein) {
      ergebnis.push(null);
      naechste(i + 1);
      return;
    }
    var vorher = alt[i];
    if (vorher && vorher.ok && vorher.start === ein.start && vorher.ziel === ein.ziel) {
      ergebnis.push(vorher);
      naechste(i + 1);
      return;
    }

    sucheHaltestelle(ein.start, function (fehler1, start) {
      sucheHaltestelle(ein.ziel, function (fehler2, ziel) {
        var v = { start: ein.start, ziel: ein.ziel, ok: !!(start && ziel) };
        if (v.ok) {
          v.startId = start.id;
          v.startName = start.name;
          v.zielId = ziel.id;
          v.zielName = ziel.name;
          console.log((i + 1) + ': ' + v.startName + ' → ' + v.zielName);
        } else {
          console.log((i + 1) + ': Haltestelle nicht gefunden (' +
            ein.start + ' / ' + ein.ziel + ')' +
            (fehler1 || fehler2 ? ' – ' + (fehler1 || fehler2) : ''));
        }
        ergebnis.push(v);
        naechste(i + 1);
      });
    });
  }

  naechste(0);
}

// ---------- Fahrplan ----------

// "2026-10-27T17:26:00Z" -> "18:26" (in der Zeitzone des Handys)
function uhrzeit(isoText) {
  var d = new Date(isoText);
  var h = d.getHours();
  var m = d.getMinutes();
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

// Differenz Ist - Soll in ganzen Minuten
function verspaetungMinuten(soll, ist) {
  return Math.round((new Date(ist) - new Date(soll)) / 60000);
}

// Macht aus einer Transitous-Verbindung ein kleines Objekt.
// Fußwege (WALK) am Anfang/Ende werden übersprungen.
function kurzfassung(itinerary) {
  var fahrten = itinerary.legs.filter(function (leg) {
    return leg.mode !== 'WALK';
  });
  if (fahrten.length === 0) {
    return null;
  }
  var erste = fahrten[0];
  var letzte = fahrten[fahrten.length - 1];
  return {
    ab: uhrzeit(erste.from.scheduledDeparture),
    an: uhrzeit(letzte.to.arrival),
    linie: erste.routeShortName || erste.mode,
    gleis: erste.from.track || erste.from.scheduledTrack || '',
    plus: verspaetungMinuten(erste.from.scheduledDeparture, erste.from.departure),
    echtzeit: !!erste.realTime
  };
}

// Fragt die nächsten Abfahrten ab, callback(fehlercode, liste)
function holeFahrplan(startId, zielId, callback) {
  var url = API + '/v5/plan' +
    '?fromPlace=' + encodeURIComponent(startId) +
    '&toPlace=' + encodeURIComponent(zielId) +
    '&time=' + encodeURIComponent(new Date().toISOString()) +
    '&maxTransfers=0' +
    '&numItineraries=3';

  console.log('Frage an: ' + url);

  holeJson(url, function (fehler, daten) {
    if (fehler) {
      console.log('Fehler: ' + fehler);
      callback(FEHLER_NETZ);
      return;
    }
    var liste = (daten.itineraries || [])
      .map(kurzfassung)
      .filter(function (v) { return v !== null; })
      .slice(0, 3);
    if (liste.length === 0) {
      callback(FEHLER_KEINE_VERBINDUNG);
      return;
    }
    callback(0, liste);
  });
}

// ---------- Start ----------

Pebble.addEventListener('ready', function () {
  console.log('Von A nach B: Handy-Teil bereit');

  // Test: erste gefundene Verbindung aus den Einstellungen abfragen
  var erste = ladeVerbindungen().filter(function (v) { return v && v.ok; })[0];
  if (!erste) {
    console.log('Noch keine Verbindungen gespeichert – bitte Einstellungen öffnen.');
    return;
  }
  console.log('Test: ' + erste.startName + ' → ' + erste.zielName);

  holeFahrplan(erste.startId, erste.zielId, function (code, liste) {
    if (code === FEHLER_KEINE_VERBINDUNG) {
      console.log('Keine Verbindung gefunden');
      return;
    }
    if (code === FEHLER_NETZ) {
      console.log('Kein Netz / API-Fehler');
      return;
    }
    liste.forEach(function (v) {
      var plus = v.plus > 0 ? ' +' + v.plus : '';
      console.log(v.ab + plus + ' -> ' + v.an + '  ' + v.linie + '  Gl. ' + v.gleis);
    });
  });
});
