// Baut die Clay-Einstellungsseite.
// Die Seite wird bei jedem Öffnen neu gebaut, damit unter jedem Paar
// steht, welche Haltestellen beim letzten Speichern gefunden wurden.

var ANZAHL = 10;

// gefunden: Liste mit Einträgen aus dem localStorage (siehe index.js),
// Index = Platz in der Einstellungsseite (0 bis 9). Leere Plätze: null.
function baueConfig(gefunden) {
  var config = [
    { type: 'heading', defaultValue: 'Von A nach B' },
    {
      type: 'text',
      defaultValue: 'Bis zu 10 Verbindungen ohne Umstieg. ' +
        'Start und Ziel als Freitext, z. B. „Essen Hbf“. ' +
        'Nach dem Speichern steht hier, welche Haltestelle gefunden wurde.'
    }
  ];

  for (var i = 0; i < ANZAHL; i++) {
    var eintrag = gefunden[i];
    var hinweis = '';
    if (eintrag && eintrag.ok) {
      hinweis = 'Gefunden: ' + eintrag.startName + ' → ' + eintrag.zielName;
    } else if (eintrag) {
      hinweis = '<b>Haltestelle nicht gefunden</b>';
    }

    var items = [
      { type: 'heading', defaultValue: 'Verbindung ' + (i + 1), size: 4 },
      { type: 'input', messageKey: 'START_' + i, label: 'Start', defaultValue: '' },
      { type: 'input', messageKey: 'ZIEL_' + i, label: 'Ziel', defaultValue: '' }
    ];
    if (hinweis) {
      items.push({ type: 'text', defaultValue: hinweis });
    }
    config.push({ type: 'section', items: items });
  }

  config.push({ type: 'submit', defaultValue: 'Speichern' });
  return config;
}

module.exports = { baueConfig: baueConfig, ANZAHL: ANZAHL };
