import Message from "pebble/message";

// Uhr-Teil: Liste der Verbindungen, Detailansicht mit den nächsten Abfahrten.
// Tasten: Hoch/Runter = Auswahl, Mitte = öffnen bzw. aktualisieren,
// Zurück = zur Liste / App beenden.

// ---------- Aussehen ----------

const ZEILE_H = 76;      // Höhe einer Verbindung in der Liste (3 pro Bildschirm)
const NUMMER_B = 30;     // Platz links für die Nummer der Verbindung
const KOPF_H = 52;       // Höhe des Kopfes in der Detailansicht
const FAHRT_H = 87;      // Höhe einer Abfahrt in der Detailansicht
const FAHRTEN_SICHTBAR = 2;  // so viele Abfahrten passen auf den Bildschirm
const LEISTE_B = 4;      // Breite der Laufleiste rechts in der Detailansicht
const UHR_B = 60;        // Platz rechts im Kopf für die Uhrzeit (Issue #6)

const weiss = new Skin({ fill: "white" });
const schwarz = new Skin({ fill: "black" });

const sStart = new Style({ font: "bold 28px Gothic", color: "black", horizontal: "left" });
const sZiel = new Style({ font: "24px Gothic", color: "black", horizontal: "left" });
const sStartHell = new Style({ font: "bold 28px Gothic", color: "white", horizontal: "left" });
const sZielHell = new Style({ font: "24px Gothic", color: "white", horizontal: "left" });
const sKopfStart = new Style({ font: "bold 24px Gothic", color: "white", horizontal: "left" });
const sKopfZiel = new Style({ font: "18px Gothic", color: "white", horizontal: "left" });
const sZeit = new Style({ font: "bold 36px Gothic", color: "black", horizontal: "left" });
const sPlus = new Style({ font: "bold 36px Gothic", color: "red", horizontal: "left" });      // ab +5
const sPuenktlich = new Style({ font: "bold 36px Gothic", color: "#00AA00", horizontal: "left" }); // +0 bis +4
const sFahrplan = new Style({ font: "24px Gothic", color: "#555555", horizontal: "left" });   // keine Echtzeit
const sFahrplanKlein = new Style({ font: "18px Gothic", color: "#555555", horizontal: "left" }); // falls 24 zu breit
const ROT_AB = 5;        // ab so vielen Minuten Verspätung rot statt grün
const sInfoHell = new Style({ font: "28px Gothic", color: "white", horizontal: "left" });
const sInfoDunkel = new Style({ font: "28px Gothic", color: "black", horizontal: "left" });

// Farbcode für die Zeile mit Linie und Gleis (Kürzel kommt vom Handy).
// Farben aus der 64-Farben-Palette der Pebble.
const FARBCODE = {
	S: { skin: new Skin({ fill: "#00AA00" }), style: sInfoHell },    // S-Bahn: Grün
	B: { skin: new Skin({ fill: "#AA00FF" }), style: sInfoHell },    // Bus: Violett
	U: { skin: new Skin({ fill: "#0055AA" }), style: sInfoHell },    // U-Bahn: Blau
	T: { skin: new Skin({ fill: "#FFFF00" }), style: sInfoDunkel },  // Tram: Gelb
	Z: { skin: new Skin({ fill: "#FF0000" }), style: sInfoHell }     // andere Züge: Rot
};
const sMeldung = new Style({ font: "bold 24px Gothic", color: "black", horizontal: "center" });

// ---------- Zustand ----------

let namen = ladeNamen();
let auswahl = 0;          // markierte Verbindung in der Liste
let ansicht = "liste";    // "liste" oder "detail"
let anfrage = null;       // Nummer der Verbindung, auf deren Fahrplan wir warten
let fahrten = [];         // empfangene Abfahrten (bis zu 5) der geöffneten Verbindung
let erste = 0;            // welche Abfahrt oben in der Detailansicht steht

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

// Kürzt einen Text so, dass er in der Schrift "style" höchstens "breite"
// Pixel breit ist. Wurde gekürzt, steht am Ende "...".
function kuerze(text, style, breite) {
	if (style.measure(text).width <= breite) {
		return text;
	}
	let laenge = text.length;
	while (laenge > 0 && style.measure(text.slice(0, laenge).trimEnd() + "...").width > breite) {
		laenge--;
	}
	return text.slice(0, laenge).trimEnd() + "...";
}

// Platz für Text zwischen linkem und rechtem Rand (je 6 Pixel)
function textBreite() {
	return app.width - 12;
}

// ---------- Tasten ----------

class Steuerung extends Behavior {
	// Die Liste ist rund: oben weiter -> letzter Eintrag, unten weiter -> erster (Issue #11)
	// In der Detailansicht blättern Up/Down um je eine Abfahrt (Issue #7).
	onPressUp() {
		if (ansicht === "liste" && namen.length > 0) {
			auswahl = (auswahl > 0) ? auswahl - 1 : namen.length - 1;
			zeigeListe();
		} else if (ansicht === "detail" && erste > 0) {
			erste--;
			zeichneFahrten();
		}
		return true;
	}
	onPressDown() {
		if (ansicht === "liste" && namen.length > 0) {
			auswahl = (auswahl < namen.length - 1) ? auswahl + 1 : 0;
			zeigeListe();
		} else if (ansicht === "detail" && erste + FAHRTEN_SICHTBAR < fahrten.length) {
			erste++;
			zeichneFahrten();
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
		const sOben = aktiv ? sStartHell : sStart;
		const sUnten = aktiv ? sZielHell : sZiel;
		const breite = textBreite() - NUMMER_B;
		app.add(new Container(null, {
			left: 0, right: 0, top: (i - anfang) * ZEILE_H, height: ZEILE_H,
			skin: aktiv ? schwarz : weiss,
			contents: [
				// Nummer der Verbindung (1 bis 10), damit man sie schneller findet
				new Label(null, { left: 6, top: 2, height: 34, width: NUMMER_B,
					style: sOben, string: String(i + 1) }),
				new Label(null, { left: 6 + NUMMER_B, right: 6, top: 2, height: 34,
					style: sOben, string: kuerze(start, sOben, breite) }),
				new Label(null, { left: 6 + NUMMER_B, right: 6, top: 36, height: 30,
					style: sUnten, string: kuerze("nach " + ziel, sUnten, breite) })
			]
		}));
	}
}

// Kopfzeile der Detailansicht und darunter Platz für Inhalt
function zeigeDetailKopf(i) {
	const [start, ziel] = teile(namen[i]);
	app.empty();
	app.add(new Container(null, {
		left: 0, right: 0, top: 0, height: KOPF_H, skin: schwarz,
		contents: [
			// rechts bleibt Platz für die Uhrzeit (Issue #6)
			new Label(null, { left: 6, right: 6 + UHR_B, top: 0, height: 28, style: sKopfStart,
				string: kuerze(start, sKopfStart, textBreite() - UHR_B) }),
			new Label(null, { left: 6, right: 6, top: 28, height: 22, style: sKopfZiel,
				string: kuerze("nach " + ziel, sKopfZiel, textBreite()) })
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
	fahrten = [];
	erste = 0;
	zeigeDetailKopf(i);
	zeigeMeldung("Lade...", KOPF_H);
	frageFahrplan(i);
}

function zeigeFehler(text) {
	zeigeDetailKopf(anfrage ?? auswahl);
	zeigeMeldung(text, KOPF_H);
	anfrage = null;
}

// Neue Abfahrten vom Handy anzeigen, oben beginnend
function zeigeFahrten(neu) {
	anfrage = null;
	fahrten = neu;
	erste = 0;
	zeichneFahrten();
}

// Zeichnet die Detailansicht neu: Kopf und die 2 Abfahrten ab Nummer "erste".
// Es werden immer nur die sichtbaren Abfahrten gebaut (spart Speicher).
function zeichneFahrten() {
	zeigeDetailKopf(auswahl);
	fahrten.slice(erste, erste + FAHRTEN_SICHTBAR).forEach((f, n) => {
		const zeitBreite = sZeit.measure(f.ab).width;
		const inhalt = [
			new Label(null, { left: 6, top: 0, height: 44, width: zeitBreite, style: sZeit, string: f.ab })
		];
		// Verspätung: grün bis +4, rot ab +5. Ohne Echtzeitdaten fehlt "plus".
		const rechts = 6 + zeitBreite + 8;
		if (f.plus === undefined) {
			const text = "lt. Fahrplan";
			// Passt der Text neben einer breiten Uhrzeit nicht in 24, dann 18 nehmen
			const passt = sFahrplan.measure(text).width <= app.width - 6 - rechts;
			inhalt.push(new Label(null, { left: rechts, right: 6,
				top: passt ? 10 : 14, height: passt ? 28 : 22,
				style: passt ? sFahrplan : sFahrplanKlein, string: text }));
		} else {
			const text = (f.plus < 0) ? String(f.plus) : "+" + f.plus;   // zu früh: "-1"
			inhalt.push(new Label(null, { left: rechts, right: 6, top: 0, height: 44,
				style: (f.plus >= ROT_AB) ? sPlus : sPuenktlich, string: text }));
		}
		// Zeile mit Linie und Gleis, Hintergrund je nach Verkehrsart
		const farbe = FARBCODE[f.art] || FARBCODE.Z;
		// Bei Bussen heißt die Haltestellen-Nummer "Steig", sonst "Gleis"
		const ort = (f.art === "B") ? "Steig" : "Gleis";
		const info = f.linie + (f.gleis ? "   " + ort + " " + f.gleis : "");
		inhalt.push(new Container(null, {
			left: 0, right: 0, top: 44, height: 36, skin: farbe.skin,
			contents: [
				new Label(null, { left: 6, right: 6, top: 0, height: 36, style: farbe.style,
					string: kuerze(info, farbe.style, textBreite()) })
			]
		}));

		app.add(new Container(null, {
			left: 0, right: 0, top: KOPF_H + 2 + n * FAHRT_H, height: FAHRT_H,
			contents: inhalt
		}));
	});
	zeigeLaufleiste();
}

// Schmaler Balken am rechten Rand: zeigt, welcher Teil der Abfahrten
// gerade zu sehen ist. Nur, wenn es mehr gibt, als auf den Bildschirm passen.
function zeigeLaufleiste() {
	if (fahrten.length <= FAHRTEN_SICHTBAR) {
		return;
	}
	const bereich = app.height - KOPF_H;   // Höhe unter dem Kopf
	const oben = Math.round(bereich * erste / fahrten.length);
	const hoehe = Math.round(bereich * FAHRTEN_SICHTBAR / fahrten.length);
	app.add(new Content(null, {
		right: 0, width: LEISTE_B, top: KOPF_H + oben, height: hoehe, skin: schwarz
	}));
}

// ---------- Nachrichten mit dem Handy ----------

const FEHLERTEXT = {
	1: "Aktuell keine Direktverbindung",
	2: "Kein Netz / API-Fehler"
};
const TIMEOUT_MS = 15000;

let schreibbereit = false;  // darf die Uhr gerade senden?
let wartend = null;         // Anfrage, die noch gesendet werden muss
let nochmal = null;         // Timer für einen erneuten Sendeversuch
let timeout = null;

const message = new Message({
	keys: ["NAMEN", "REQUEST", "FEHLER", "FAHRTEN"],
	input: 1024,   // Platz für bis zu 10 Anzeigenamen

	onReadable() {
		const msg = this.read();

		// Liste der Verbindungen (beim Start und nach dem Speichern der Einstellungen).
		// Nur neu aufbauen, wenn sich etwas geändert hat.
		if (msg.has("NAMEN") && msg.get("NAMEN") !== localStorage.getItem("namen")) {
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
		sende();
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
	wartend = i;
	sende();

	stoppeTimeout();
	timeout = setTimeout(() => {
		timeout = null;
		wartend = null;
		zeigeFehler("Keine Antwort vom Handy");
	}, TIMEOUT_MS);
}

// Schickt die wartende Anfrage ans Handy, sobald das möglich ist.
// Ist der Ausgang noch belegt (z. B. weil gerade eine Nachricht ankommt),
// wirft write() einen Fehler. Dann nach kurzer Pause erneut versuchen,
// statt die App abstürzen zu lassen (Issue #10).
function sende() {
	if (wartend === null || !schreibbereit) {
		return;   // nichts zu tun, oder onWritable() ruft uns später auf
	}
	try {
		message.write(new Map([["REQUEST", wartend]]));
	} catch (e) {
		if (nochmal === null) {
			nochmal = setTimeout(() => {
				nochmal = null;
				sende();
			}, 500);
		}
		return;
	}
	wartend = null;
	schreibbereit = false;   // erst nach dem nächsten onWritable() wieder senden
}

function stoppeTimeout() {
	if (timeout !== null) {
		clearTimeout(timeout);
		timeout = null;
	}
}

// ---------- Start ----------

zeigeListe();
