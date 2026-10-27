import Poco from "commodetto/Poco";
import Message from "pebble/message";

// Schritt 3: Nachrichten Uhr <-> Handy, Ausgabe nur in der Konsole.
// Die Uhrzeit-Anzeige stammt noch aus der Vorlage und wird in Schritt 4
// durch die richtige Oberfläche ersetzt.

let render = new Poco(screen);

const font = new render.Font("Bitham-Black", 30);
const black = render.makeColor(0, 0, 0);
const white = render.makeColor(255, 255, 255);

function draw() {
	render.begin();
	render.fillRectangle(white, 0, 0, render.width, render.height);

	const msg = (new Date).toTimeString().slice(0, 8);
	const width = render.getTextWidth(msg, font);

	render.drawText(msg, font, black,
		(render.width - width) / 2, (render.height - font.height) / 2);

	render.end();
}

watch.addEventListener('secondchange', draw);

// ---------- Verbindungen (Anzeigenamen) ----------

function ladeNamen() {
	try {
		return JSON.parse(localStorage.getItem("namen")) || [];
	} catch (e) {
		return [];
	}
}

// ---------- Nachrichten ----------

const FEHLERTEXT = {
	1: "Keine Verbindung gefunden",
	2: "Kein Netz / API-Fehler"
};
const TIMEOUT_MS = 15000;

let schreibbereit = false;   // darf die Uhr gerade senden?
let timeout = null;          // läuft gerade eine Anfrage?
let testGesendet = false;

const message = new Message({
	keys: ["NAMEN", "REQUEST", "FEHLER", "FAHRTEN"],
	input: 1024,   // Platz für bis zu 10 Anzeigenamen

	onReadable() {
		const msg = this.read();

		// Neue Liste der Verbindungen (nach dem Speichern der Einstellungen)
		if (msg.has("NAMEN")) {
			localStorage.setItem("namen", msg.get("NAMEN"));
			console.log("Neue Verbindungen gespeichert: " + msg.get("NAMEN"));
		}

		// Antwort auf eine Fahrplan-Anfrage
		if (msg.has("FEHLER")) {
			stoppeTimeout();
			const fehler = msg.get("FEHLER");
			if (fehler !== 0) {
				console.log(FEHLERTEXT[fehler] || ("Fehler " + fehler));
				return;
			}
			const fahrten = JSON.parse(msg.get("FAHRTEN"));
			for (const f of fahrten) {
				const plus = f.plus > 0 ? " +" + f.plus : "";
				console.log(f.ab + plus + "  " + f.linie + "  Gl. " + f.gleis);
			}
		}
	},

	onWritable() {
		schreibbereit = true;
		// Test: beim ersten Mal automatisch Verbindung 1 abfragen
		if (!testGesendet) {
			testGesendet = true;
			frageFahrplan(0);
		}
	},

	onSuspend() {
		schreibbereit = false;
	}
});

// Fragt beim Handy den Fahrplan für Verbindung i an (i beginnt bei 0).
function frageFahrplan(i) {
	const namen = ladeNamen();
	if (!namen[i]) {
		console.log("Keine Verbindungen. Verbindungen in den Einstellungen anlegen.");
		return;
	}
	if (!watch.connected.app || !schreibbereit) {
		console.log("Keine Verbindung zum Handy");
		return;
	}
	console.log("Frage an: " + namen[i]);
	message.write(new Map([["REQUEST", i]]));

	stoppeTimeout();
	timeout = setTimeout(() => {
		timeout = null;
		console.log("Keine Antwort vom Handy (Zeitüberschreitung)");
	}, TIMEOUT_MS);
}

function stoppeTimeout() {
	if (timeout !== null) {
		clearTimeout(timeout);
		timeout = null;
	}
}

console.log("Von A nach B gestartet. Gespeicherte Verbindungen: " + ladeNamen().length);
