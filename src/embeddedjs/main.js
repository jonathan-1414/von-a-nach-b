import Message from "pebble/message";

// Uhr-Teil: Liste der Verbindungen, Detailansicht mit den nächsten Abfahrten.
// Tasten: Hoch/Runter = Auswahl, Mitte = öffnen bzw. aktualisieren,
// Zurück = zur Liste / App beenden.

// ---------- Aussehen ----------

const ZEILE_H = 52;   // Höhe einer Verbindung in der Liste
const FAHRT_H = 56;   // Höhe einer Abfahrt in der Detailansicht

const weiss = new Skin({ fill: "white" });
const schwarz = new Skin({ fill: "black" });

const sStart = new Style({ font: "bold 24px Gothic", color: "black", horizontal: "left" });
const sZiel = new Style({ font: "18px Gothic", color: "black", horizontal: "left" });
const sStartHell = new Style({ font: "bold 24px Gothic", color: "white", horizontal: "left" });
const sZielHell = new Style({ font: "18px Gothic", color: "white", horizontal: "left" });
const sKopfStart = new Style({ font: "bold 18px Gothic", color: "white", horizontal: "left" });
const sKopfZiel = new Style({ font: "18px Gothic", color: "white", horizontal: "left" });
const sZeit = new Style({ font: "bold 28px Gothic", color: "black", horizontal: "left" });
const sPlus = new Style({ font: "bold 28px Gothic", color: "red", horizontal: "left" });
const sInfo = new Style({ font: "18px Gothic", color: "black", horizontal: "left" });
const sMeldung = new Style({ font: "bold 24px Gothic", color: "black", horizontal: "center" });

// ---------- Zustand ----------

let namen = ladeNamen();
let auswahl = 0;          // markierte Verbindung in der Liste
let ansicht = "liste";    // "liste" oder "detail"
let anfrage = null;       // Nummer der Verbindung, auf deren Fahrplan wir warten

function ladeNamen() {
	try {
		return JSON.parse(localStorage.getItem("namen")) || [];
	} catch (e) {
		return [];
	}
}

// "Köln Hbf → Düsseldorf Hbf" -> ["Köln Hbf", "Düsseldorf Hbf"]
function teile(name) {
	const teile = name.split(" → ");
	return [teile[0], teile[1] || ""];
}

// ---------- Tasten ----------

class Steuerung extends Behavior {
	onPressUp() {
		if (ansicht === "liste" && auswahl > 0) {
			auswahl--;
			zeigeListe();
		}
		return true;
	}
	onPressDown() {
		if (ansicht === "liste" && auswahl < namen.length - 1) {
			auswahl++;
			zeigeListe();
		}
		return true;
	}
	onPressSelect() {
		if (ansicht === "liste" && namen.length > 0) {
			oeffneDetail(auswahl);
		} else if (ansicht === "detail" && anfrage === null) {
			oeffneDetail(auswahl);   // Aktualisieren (nicht, während noch geladen wird)
		}
		return true;
	}
	onPressBack() {
		if (ansicht === "detail") {
			zeigeListe();
			return true;    // Taste erledigt, App bleibt offen
		}
		return false;       // in der Liste: App beenden
	}
}

const app = new Application(null, {
	skin: weiss,
	Behavior: Steuerung,
	contents: []
});
app.focus();

// ---------- Ansichten ----------

function zeigeListe() {
	ansicht = "liste";
	anfrage = null;
	stoppeTimeout();
	app.empty();

	if (namen.length === 0) {
		zeigeMeldung("Verbindungen in den Einstellungen anlegen");
		return;
	}

	// Nur so viele Zeilen zeigen, wie auf den Bildschirm passen,
	// und dabei die markierte Zeile immer sichtbar halten.
	const sichtbar = Math.floor(app.height / ZEILE_H);
	const anfang = Math.max(0, auswahl - sichtbar + 1);

	for (let i = anfang; i < namen.length && i < anfang + sichtbar; i++) {
		const [start, ziel] = teile(namen[i]);
		const aktiv = (i === auswahl);
		app.add(new Container(null, {
			left: 0, right: 0, top: (i - anfang) * ZEILE_H, height: ZEILE_H,
			skin: aktiv ? schwarz : weiss,
			contents: [
				new Label(null, { left: 6, right: 6, top: 0, height: 28,
					style: aktiv ? sStartHell : sStart, string: start }),
				new Label(null, { left: 6, right: 6, top: 26, height: 22,
					style: aktiv ? sZielHell : sZiel, string: "nach " + ziel })
			]
		}));
	}
}

// Kopfzeile der Detailansicht und darunter Platz für Inhalt
function zeigeDetailKopf(i) {
	const [start, ziel] = teile(namen[i]);
	app.empty();
	app.add(new Container(null, {
		left: 0, right: 0, top: 0, height: 46, skin: schwarz,
		contents: [
			new Label(null, { left: 6, right: 6, top: 2, height: 22, style: sKopfStart, string: start }),
			new Label(null, { left: 6, right: 6, top: 22, height: 22, style: sKopfZiel, string: "nach " + ziel })
		]
	}));
}

function zeigeMeldung(text, oben = 0) {
	app.add(new Text(null, {
		left: 10, right: 10, top: oben + 40, style: sMeldung, string: text
	}));
}

function oeffneDetail(i) {
	ansicht = "detail";
	zeigeDetailKopf(i);
	zeigeMeldung("Lade...", 46);
	frageFahrplan(i);
}

function zeigeFehler(text) {
	zeigeDetailKopf(anfrage ?? auswahl);
	zeigeMeldung(text, 46);
	anfrage = null;
}

function zeigeFahrten(fahrten) {
	zeigeDetailKopf(anfrage);
	anfrage = null;
	fahrten.forEach((f, n) => {
		const inhalt = [
			new Label(null, { left: 6, top: 0, height: 32, width: 70, style: sZeit, string: f.ab })
		];
		if (f.plus > 0) {
			inhalt.push(new Label(null, { left: 76, top: 0, height: 32, width: 60,
				style: sPlus, string: "+" + f.plus }));
		}
		const info = f.linie + (f.gleis ? "   Gleis " + f.gleis : "");
		inhalt.push(new Label(null, { left: 6, right: 6, top: 30, height: 22, style: sInfo, string: info }));

		app.add(new Container(null, {
			left: 0, right: 0, top: 50 + n * FAHRT_H, height: FAHRT_H,
			contents: inhalt
		}));
	});
}

// ---------- Nachrichten mit dem Handy ----------

const FEHLERTEXT = {
	1: "Keine Verbindung gefunden",
	2: "Kein Netz / API-Fehler"
};
const TIMEOUT_MS = 15000;

let schreibbereit = false;  // darf die Uhr gerade senden?
let wartend = null;         // Anfrage, die noch gesendet werden muss
let timeout = null;

const message = new Message({
	keys: ["NAMEN", "REQUEST", "FEHLER", "FAHRTEN"],
	input: 1024,   // Platz für bis zu 10 Anzeigenamen

	onReadable() {
		const msg = this.read();

		// Neue Liste der Verbindungen (nach dem Speichern der Einstellungen)
		if (msg.has("NAMEN")) {
			localStorage.setItem("namen", msg.get("NAMEN"));
			namen = ladeNamen();
			auswahl = Math.min(auswahl, Math.max(0, namen.length - 1));
			if (ansicht === "liste") {
				zeigeListe();
			}
		}

		// Antwort auf eine Fahrplan-Anfrage
		if (msg.has("FEHLER")) {
			if (anfrage === null) {
				return;   // zu spät oder Ansicht schon verlassen
			}
			stoppeTimeout();
			const fehler = msg.get("FEHLER");
			if (fehler !== 0) {
				zeigeFehler(FEHLERTEXT[fehler] || ("Fehler " + fehler));
				return;
			}
			zeigeFahrten(JSON.parse(msg.get("FAHRTEN")));
		}
	},

	onWritable() {
		schreibbereit = true;
		// Wurde eine Verbindung gewählt, bevor das Handy bereit war?
		if (wartend !== null) {
			message.write(new Map([["REQUEST", wartend]]));
			wartend = null;
		}
	},

	onSuspend() {
		schreibbereit = false;
	}
});

// Fragt beim Handy den Fahrplan für Verbindung i an (i beginnt bei 0).
function frageFahrplan(i) {
	anfrage = i;
	if (!watch.connected.app) {
		zeigeFehler("Keine Verbindung zum Handy");
		return;
	}
	if (schreibbereit) {
		message.write(new Map([["REQUEST", i]]));
	} else {
		wartend = i;  // wird gesendet, sobald das Handy bereit ist
	}

	stoppeTimeout();
	timeout = setTimeout(() => {
		timeout = null;
		wartend = null;
		zeigeFehler("Keine Antwort vom Handy");
	}, TIMEOUT_MS);
}

function stoppeTimeout() {
	if (timeout !== null) {
		clearTimeout(timeout);
		timeout = null;
	}
}

// ---------- Start ----------

zeigeListe();
