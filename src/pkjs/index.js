// Handy-Teil (PebbleKit JS).
// Schritt 1: Fahrplan für eine fest eingetragene Verbindung abfragen
// und das Ergebnis nur in der Konsole ausgeben.

var API = 'https://api.transitous.org/api';
var USER_AGENT = 'VonAnachB/0.1 (Pebble)';

// Fest eingetragene Test-Verbindung (IDs aus Transitous "geocode")
var TEST_START = 'be-sncb_8015458'; // Köln Hbf
var TEST_ZIEL = 'at-Railway-Current-Reference-Data-2026_de:05111:18235:93:16'; // Düsseldorf Hbf

// Fehlercodes (später auch für die Uhr)
var FEHLER_KEINE_VERBINDUNG = 1;
var FEHLER_NETZ = 2;

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

Pebble.addEventListener('ready', function () {
  console.log('Von A nach B: Handy-Teil bereit');

  holeFahrplan(TEST_START, TEST_ZIEL, function (code, liste) {
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
