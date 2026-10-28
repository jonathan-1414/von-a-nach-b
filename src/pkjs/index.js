// Handy-Teil (PebbleKit JS).
// - Einstellungen (Clay) speichern, Haltestellen per Transitous geocode auflösen
// - Namensliste an die Uhr schicken (nach dem Speichern und bei jedem App-Start)
// - Fahrplan-Anfragen der Uhr beantworten (Transitous plan)

var Clay = require('@rebble/clay');
var config = require('./config');

// Hilfsmodul von Alloy: beantwortet das "Bereit?"-Signal der Uhr.
// Erst danach darf die Uhr Nachrichten senden.
var moddableProxy = require('@moddable/pebbleproxy');

// autoHandleEvents: false = wir öffnen und schließen die Seite selbst,
// damit wir die Seite mit den gefundenen Namen bauen und nach dem
// Speichern die Haltestellen suchen können.
// Clay schaut beim Erzeugen nach, welche Bausteine (Eingabefeld, Text, ...)
// vorkommen. Deshalb hier schon eine vollständige Seite übergeben.
var clay = new Clay(config.baueConfig([]), null, { autoHandleEvents: false });

var API = 'https://api.transitous.org/api';
// Transitous verlangt App-Name, Version und eine Kontaktmöglichkeit.
var USER_AGENT = 'VonAnachB/0.2.0 (Pebble; +https://github.com/jonathan-1414/von-a-nach-b)';

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

// Nur die gefundenen Verbindungen. Die Uhr kennt nur diese Liste,
// "REQUEST: i" meint also den i-ten Eintrag hier.
function gefundeneVerbindungen() {
  return ladeVerbindungen().filter(function (v) { return v && v.ok; });
}

// Anzeigenamen für die Uhr
function anzeigeNamen() {
  return gefundeneVerbindungen().map(function (v) {
    return v.startName + ' → ' + v.zielName;
  });
}

// ---------- Nachrichten an die Uhr ----------

// Über die Warteschlange des Alloy-Hilfsmoduls senden: so gehen Nachrichten
// nacheinander raus und kollidieren nicht mit dessen "Bereit"-Nachricht.
function sendeAnUhr(paket) {
  moddableProxy.sendAppMessage(paket, function () {
    console.log('An die Uhr gesendet: ' + JSON.stringify(paket));
  }, function () {
    console.log('Senden an die Uhr fehlgeschlagen (App auf der Uhr offen?)');
  });
}

function sendeNamen() {
  sendeAnUhr({ NAMEN: JSON.stringify(anzeigeNamen()) });
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
    sendeNamen();
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

// Verkehrsart als Kürzel für den Farbcode auf der Uhr:
// S = S-Bahn, B = Bus, U = U-Bahn, T = Tram/Straßenbahn, Z = alle anderen Züge
function verkehrsart(mode) {
  switch (mode) {
    case 'SUBURBAN': return 'S';
    case 'BUS':
    case 'COACH': return 'B';
    case 'SUBWAY':
    case 'METRO': return 'U';
    case 'TRAM':
    case 'CABLE_CAR': return 'T';
    default: return 'Z';
  }
}

// Macht aus einer Transitous-Verbindung ein kleines Objekt für die Uhr.
// Fußwege (WALK) am Anfang/Ende werden übersprungen.
function kurzfassung(itinerary) {
  var fahrten = itinerary.legs.filter(function (leg) {
    return leg.mode !== 'WALK';
  });
  if (fahrten.length === 0) {
    return null;
  }
  var erste = fahrten[0];
  return {
    ab: uhrzeit(erste.from.scheduledDeparture),
    linie: erste.routeShortName || erste.mode,
    art: verkehrsart(erste.mode),
    gleis: erste.from.track || erste.from.scheduledTrack || '',
    plus: verspaetungMinuten(erste.from.scheduledDeparture, erste.from.departure)
  };
}

// Fragt die nächsten Abfahrten ab, callback(fehlercode, liste)
function holeFahrplan(startId, zielId, callback) {
  var url = API + '/v5/plan' +
    '?fromPlace=' + encodeURIComponent(startId) +
    '&toPlace=' + encodeURIComponent(zielId) +
    '&time=' + encodeURIComponent(new Date().toISOString()) +
    '&maxTransfers=0' +
    // Fußwege zählen bei Transitous nicht als Umstieg. Ohne Grenze kämen
    // Verbindungen wie "S-Bahn + 1 km zu Fuß" (Issue #3).
    '&maxPreTransitTime=300' +    // höchstens 5 min zu Fuß vor der Fahrt
    '&maxPostTransitTime=300' +   // höchstens 5 min zu Fuß nach der Fahrt
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
  moddableProxy.readyReceived();
  // Namensliste bei jedem Start schicken, damit die Uhr aktuell ist,
  // auch wenn die App beim Speichern der Einstellungen nicht offen war.
  sendeNamen();
});

// Anfrage von der Uhr: { REQUEST: i }
Pebble.addEventListener('appmessage', function (e) {
  if (moddableProxy.appMessageReceived(e)) {
    return; // war eine interne Alloy-Nachricht
  }
  var i = e.payload.REQUEST;
  if (typeof i !== 'number') {
    return;
  }
  var v = gefundeneVerbindungen()[i];
  if (!v) {
    // Die Liste auf der Uhr ist veraltet: neue Liste mitschicken.
    console.log('Verbindung ' + i + ' gibt es nicht');
    sendeAnUhr({
      NAMEN: JSON.stringify(anzeigeNamen()),
      FEHLER: FEHLER_KEINE_VERBINDUNG
    });
    return;
  }
  console.log('Uhr fragt: ' + v.startName + ' → ' + v.zielName);

  holeFahrplan(v.startId, v.zielId, function (code, liste) {
    if (code !== 0) {
      sendeAnUhr({ FEHLER: code });
      return;
    }
    sendeAnUhr({ FEHLER: 0, FAHRTEN: JSON.stringify(liste) });
  });
});
