/** @typedef {{ title: string, body: string }} RuleSection */
/** @typedef {{
 *   id: string,
 *   name: string,
 *   blurb: string,
 *   players: { min: number, max: number, fixed?: number },
 *   lowerIsBetter: boolean,
 *   scoreMode: "manual" | "wizard" | "phase10",
 *   rules: RuleSection[],
 * }} TabletopGame */

/** @type {TabletopGame[]} */
export const TABLETOP_GAMES = [
  {
    id: "doppelkopf",
    name: "Doppelkopf",
    blurb: "Klassisches Stichspiel zu viert mit Re und Kontra. Hier trägst du die Punktergebnisse jeder Runde ein.",
    players: { min: 4, max: 4, fixed: 4 },
    lowerIsBetter: false,
    scoreMode: "manual",
    rules: [
      {
        title: "Ziel",
        body: "Zwei Parteien (Re und Kontra) spielen gegeneinander. Ziel einer Runde ist, mehr Augen (Punkte der Stichkarten) zu gewinnen als die Gegenseite. Über mehrere Runden sammelt jeder Spieler Spielpunkte laut Abrechnung.",
      },
      {
        title: "Material & Spieler",
        body: "Doppelkopf wird mit einem Doppelkopf-Blatt gespielt (typisch 48 Karten: zwei kurze Skatblätter ohne die Sechsen, oder 40 Karten ohne Neunen — je nach Variante). Es spielen genau 4 Personen. Jeder erhält 12 Karten (bei 48er-Blatt).",
      },
      {
        title: "Trumpf-Reihenfolge (Standard, ohne Neunen)",
        body: "Trumpf von hoch nach niedrig: Kreuz-Dame, Pik-Dame, Herz-Dame, Karo-Dame, Kreuz-Bube, Pik-Bube, Herz-Bube, Karo-Bube, dann die Karo-Karten (Ass, Zehn, König, Neun, Acht, Sieben — je nach Blatt). Alle übrigen Farben (Kreuz, Pik, Herz ohne Damen/Buben) sind Fehlfarben. Die beiden Kreuz-Damen gehören zur Re-Partei; wer sie hält, spielt Re (außer bei Sonderverträgen).",
      },
      {
        title: "Augenwerte",
        body: "Ass = 11, Zehn = 10, König = 4, Dame = 3, Bube = 2, restliche Karten = 0. Insgesamt gibt es 240 Augen im Blatt.",
      },
      {
        title: "Ablauf einer Runde",
        body: "Nach dem Geben prüft man Ansagen (Re/Kontra, optional weitere Ansagen wie keine 90). Es wird im Uhrzeigersinn gestochen. Farbzwang und Trumpfzwang gelten: Wer die ausgespielte Farbe/Trumpf bedienen kann, muss das tun. Höchste Karte der geforderten Farbe bzw. höchster Trumpf sticht. Die Partei mit ≥121 Augen gewinnt die Runde (sonst verlieren Re / gewinnen Kontra — je nach Variante und Ansagen).",
      },
      {
        title: "Re und Kontra",
        body: "Die Spieler mit den Kreuz-Damen bilden die Re-Partei (offen oder verdeckt, je nachdem wann die Damen fallen). Die anderen beiden sind Kontra. Vor dem ersten Stich (oder laut Hausregel) können Re und Kontra angesagt werden; das verdoppelt bzw. verändert die Wertung. Weitere Ansagen (keine 90, keine 60, …) erhöhen den Spielewert, wenn die Bedingungen erfüllt werden.",
      },
      {
        title: "Sonderverträge (Überblick)",
        body: "Häufige Sonderregeln: Hochzeit (eine Kreuz-Dame allein — Partner wird durch ersten gewonnenen Fremdstich bestimmt), Solo (ein Spieler spielt allein gegen drei), Armut, Pflichtsolo. Welche Soli erlaubt sind und wie sie gewertet werden, legt die Tischregel / DKV-Turnierordnung fest.",
      },
      {
        title: "Wertung (typisch)",
        body: "Grundwert oft 1 Spielpunkt für den normalen Sieg. Zusätze für angesagtes Re/Kontra, gegen die Alten, Schwarz (Gegner 0 Augen), Absagen (keine 90 usw.). Verlierer zahlen an Gewinner — bei Partnerschaft jeweils die beiden Partner. Am Tisch werden die Punkte meist auf dem Block notiert.",
      },
      {
        title: "In diesem Zähler",
        body: "Trage nach jeder Runde die vereinbarten Plus-/Minuspunkte pro Spieler ein (so wie auf eurem Block). Die App berechnet die laufende Summe. Regeln hier dienen als Nachschlagehilfe — die genaue Haus- oder Turnierwertung könnt ihr selbst festlegen.",
      },
    ],
  },
  {
    id: "wizard",
    name: "Wizard",
    blurb: "Stichspiel mit Zauberern und Narren: Ansagen treffen und Punkte sammeln.",
    players: { min: 3, max: 6 },
    lowerIsBetter: false,
    scoreMode: "wizard",
    rules: [
      {
        title: "Ziel",
        body: "Über mehrere Runden möglichst viele Punkte sammeln, indem man genau so viele Stiche macht, wie man angesagt hat.",
      },
      {
        title: "Material & Spieler",
        body: "Wizard-Kartenspiel: 60 Karten — je 13 Karten in vier Farben (1–13) sowie 4 Zauberer und 4 Narren. 3 bis 6 Spieler.",
      },
      {
        title: "Rundenaufbau",
        body: "Die Partie hat so viele Runden, wie Karten pro Spieler maximal ausgeteilt werden können (bei 3 Spielern 20 Runden, bei 4 = 15, bei 5 = 12, bei 6 = 10). In Runde 1 erhält jeder 1 Karte, in Runde 2 jeder 2 Karten usw., bis alle Karten ausgeteilt sind.",
      },
      {
        title: "Trumpf bestimmen",
        body: "Nach dem Geben wird die nächste Karte des Talons aufgedeckt: Ist es eine Farbkarte, ist diese Farbe Trumpf. Ist es ein Narr, gibt es keinen Trumpf. Ist es ein Zauberer, wählt der Geber (oder der Spieler links vom Geber — je nach Regelheft) die Trumpffarbe. In der letzten Runde (alle Karten ausgeteilt) gibt es keinen Trumpf.",
      },
      {
        title: "Ansagen",
        body: "Beginnend links vom Geber sagt jeder reihum, wie viele Stiche er machen will (0 bis zur Anzahl der Handkarten). Die Ansagen werden notiert. Es gibt keine Pflicht, dass die Summe der Ansagen ungleich der Stichzahl sein muss (im Gegensatz zu manchen Varianten anderer Spiele).",
      },
      {
        title: "Stechen",
        body: "Links vom Geber wird ausgespielt. Bedienen der Farbe ist Pflicht, wenn möglich. Narren und Zauberer gelten als spezielle Karten: Ein Narr verliert immer (außer alle Karten im Stich sind Narren — dann sticht der erste Narr). Ein Zauberer sticht immer; der erste Zauberer im Stich gewinnt ihn, weitere Zauberer zählen nicht höher. Trumpf sticht Fehlfarbe, höhere Karte gleicher Farbe sticht niedrigere.",
      },
      {
        title: "Wertung",
        body: "Stimmt die Stichzahl mit der Ansage überein: 20 Punkte plus 10 Punkte je Stich. Weicht sie ab: −10 Punkte je Stich Differenz (zu viel oder zu wenig). Beispiel: Ansage 3, gemacht 3 → 50 Punkte. Ansage 2, gemacht 4 → −20 Punkte.",
      },
      {
        title: "Spielende",
        body: "Nach der letzten Runde gewinnt, wer die meisten Punkte hat. Bei Gleichstand teilt man den Sieg oder spielt eine Stichrunde nach Hausregel.",
      },
      {
        title: "In diesem Zähler",
        body: "Gib pro Runde Ansage und gemachte Stiche ein — die Punkte werden automatisch berechnet.",
      },
    ],
  },
  {
    id: "skyjo",
    name: "Skyjo",
    blurb: "Karten umdrehen, tauschen und die niedrigste Gesamtpunktzahl erreichen.",
    players: { min: 2, max: 8 },
    lowerIsBetter: true,
    scoreMode: "manual",
    rules: [
      {
        title: "Ziel",
        body: "Am Ende möglichst wenige Punkte haben. Das Spiel endet typischerweise, sobald ein Spieler 100 oder mehr Punkte erreicht hat — wer dann die wenigsten Punkte hat, gewinnt.",
      },
      {
        title: "Material & Aufbau",
        body: "Skyjo-Karten von −2 bis 12 (bestimmte Häufigkeiten). Jeder Spieler erhält 12 Karten verdeckt in einem 3×4-Raster. Zwei Karten pro Spieler werden zu Beginn aufgedeckt. Ein Nachzieh- und ein Ablagestapel werden gebildet.",
      },
      {
        title: "Zug",
        body: "Am Zug wählst du: oberste Ablagekarte nehmen oder vom Nachziehstapel ziehen. Die gezogene/genommene Karte tauschst du gegen eine deiner Karten (offen oder verdeckt) aus; die ersetzte Karte kommt auf den Ablagestapel. Alternativ darfst du eine gezogene Karte vom Nachziehstapel sofort ablegen und dafür eine noch verdeckte eigene Karte aufdecken.",
      },
      {
        title: "Spalten-Regel",
        body: "Liegen in einer Spalte drei gleiche offene Werte, wird die ganze Spalte abgelegt und zählt nicht mehr. Das senkt die Punktzahl stark.",
      },
      {
        title: "Rundenende",
        body: "Sobald ein Spieler alle 12 Karten offen liegen hat, endet die Runde nach dem Durchgang der übrigen Spieler (jeder kommt noch einmal dran). Alle verdeckten Karten werden aufgedeckt und addiert.",
      },
      {
        title: "Wertung",
        body: "Summe aller offenen Kartenwerte ist die Rundenzahl. Sonderheit: Wer die Runde beendet hat, aber nicht die niedrigste Rundensumme hat, erhält oft die doppelte Punktzahl dieser Runde (Skyjo-Strafregel — bitte Regelheft eurer Ausgabe prüfen; viele spielen mit dieser Verdopplung).",
      },
      {
        title: "Spielende",
        body: "Erreicht oder überschreitet mindestens ein Spieler 100 Punkte, endet das Spiel nach dieser Runde. Der Spieler mit den wenigsten Gesamtpunkten gewinnt.",
      },
      {
        title: "In diesem Zähler",
        body: "Trage nach jeder Runde die (bereits berechnete) Rundensumme je Spieler ein. Ab 100 Punkten erscheint ein Hinweis.",
      },
    ],
  },
  {
    id: "phase10",
    name: "Phase 10",
    blurb: "Zehn Phasen nacheinander erfüllen und dabei Strafpunkte niedrig halten.",
    players: { min: 2, max: 6 },
    lowerIsBetter: true,
    scoreMode: "phase10",
    rules: [
      {
        title: "Ziel",
        body: "Als Erster alle 10 Phasen abschließen. Bei mehreren, die Phase 10 schaffen, gewinnt, wer die wenigsten Strafpunkte hat.",
      },
      {
        title: "Material",
        body: "Phase-10-Kartenspiel mit Zahlenkarten in Farben sowie Joker- und Aussetzkarten. 2 bis 6 Spieler.",
      },
      {
        title: "Die 10 Phasen",
        body: "1) 2 Drillinge · 2) 1 Drilling + 1 Viererfolge · 3) 1 Vierling + 1 Viererfolge · 4) 1 Siebenerfolge · 5) 1 Achterfolge · 6) 1 Neunerfolge · 7) 2 Vierlinge · 8) 7 Karten einer Farbe · 9) 1 Fünfling + 1 Drilling · 10) 1 Fünfling + 1 Dreierfolge. Eine Folge ist aufeinanderfolgende Zahlen; Farbe muss nur bei Phase 8 einheitlich sein. Joker ersetzen beliebige Karten laut Regeln.",
      },
      {
        title: "Ablauf",
        body: "Jeder startet mit Phase 1. Pro Zug: Karte ziehen (Stapel oder Ablage), optional die aktuelle Phase auslegen und/oder an ausliegende Kombinationen anlegen (wenn die eigene Phase schon liegt), dann eine Karte ablegen. Wer zuerst alle Handkarten loswird, beendet die Runde.",
      },
      {
        title: "Phasen fortschreiten",
        body: "Nur wer seine Phase in der Runde erfüllt hat, rückt zur nächsten Phase vor. Wer sie nicht geschafft hat, muss dieselbe Phase in der nächsten Runde erneut versuchen.",
      },
      {
        title: "Strafpunkte",
        body: "Am Rundenende zählen die Karten auf der Hand: typisch 5 Punkte für Karten 1–9, 10 Punkte für 10–12, 15 für Aussetzen, 25 für Joker (Werte je nach Ausgabe). Wer die Runde beendet hat, erhält 0 Strafpunkte in dieser Runde.",
      },
      {
        title: "Spielende",
        body: "Sobald ein Spieler Phase 10 erfüllt und die Runde beendet bzw. Phase 10 geschafft hat, endet das Spiel nach dieser Runde. Unter allen, die Phase 10 abgeschlossen haben, siegt die niedrigste Punktzahl.",
      },
      {
        title: "In diesem Zähler",
        body: "Trage Strafpunkte ein und markiere, wer die Phase geschafft hat. Die App merkt sich die aktuelle Phase je Spieler.",
      },
    ],
  },
  {
    id: "romme",
    name: "Rommé",
    blurb: "Kombinationen auslegen, Hand leeren und dem Gegner Punkte aufbürden.",
    players: { min: 2, max: 6 },
    lowerIsBetter: true,
    scoreMode: "manual",
    rules: [
      {
        title: "Ziel",
        body: "Durch Auslegen von Gruppen und Folgen möglichst wenige Punkte auf der Hand behalten. Oft wird bis zu einem Zielwert (z. B. 500 oder 1000 Strafpunkte) gespielt — wer dann am wenigsten hat, gewinnt; Varianten mit Pluspunkten existieren.",
      },
      {
        title: "Material",
        body: "Zwei Skat- oder französische Blätter plus Joker (je nach Variante 2–6 Joker). 2 bis 6 Spieler. Jeder erhält zu Beginn eine feste Hand (häufig 13 Karten, Geber 14).",
      },
      {
        title: "Kombinationen",
        body: "Gruppe (Satz): mindestens 3 Karten gleichen Wertes, verschiedene Farben. Folge (Straße): mindestens 3 aufeinanderfolgende Werte derselben Farbe. Joker ersetzen fehlende Karten.",
      },
      {
        title: "Ablauf",
        body: "Ziehen vom Stapel oder der Ablage, optional auslegen und anlegen, dann eine Karte ablegen. Zum ersten Auslegen muss oft ein Mindestwert (z. B. 40 oder 50 Augen) erreicht werden (Erstmeldung).",
      },
      {
        title: "Rommé / Aus",
        body: "Wer alle Handkarten regelkonform loswird, ist aus. Manche Varianten erlauben „Rommé“, wenn man in einem Zug die gesamte Hand auf einmal auslegt.",
      },
      {
        title: "Wertung",
        body: "Spieler, die nicht aus sind, erhalten Strafpunkte für restliche Handkarten (Ass oft 11 oder 15, Bild 10, Zahlen Nennwert, Joker höher). Der Ausspielende erhält 0; manchmal bekommt er die Summe der anderen gutgeschrieben (Pluswertung).",
      },
      {
        title: "In diesem Zähler",
        body: "Trage die vereinbarten Rundenergebnisse je Spieler ein (Plus oder Strafpunkte — wie an eurem Tisch üblich). Laufende Summe wird angezeigt.",
      },
    ],
  },
  {
    id: "qwixx",
    name: "Qwixx",
    blurb: "Würfelspiel: Zahlenreihen abkreuzen und Fehlwürfe vermeiden.",
    players: { min: 2, max: 5 },
    lowerIsBetter: false,
    scoreMode: "manual",
    rules: [
      {
        title: "Ziel",
        body: "Auf dem Wertungsblock in vier farbigen Reihen möglichst viele Zahlen abkreuzen und am Ende die höchste Punktzahl erreichen.",
      },
      {
        title: "Material",
        body: "6 Würfel (2 weiß, je 1× rot, gelb, grün, blau) und je ein Qwixx-Block pro Person. 2 bis 5 Spieler (auch solitär möglich, hier ab 2).",
      },
      {
        title: "Reihen",
        body: "Rot und Gelb laufen aufsteigend 2→12, Grün und Blau absteigend 12→2. In einer Reihe darf nur von links nach rechts (bzw. der Richtung) angekreuzt werden; links liegende Zahlen dürfen danach nicht mehr gewählt werden.",
      },
      {
        title: "Zug",
        body: "Der aktive Spieler würfelt alle Würfel. Zuerst darf jeder (inkl. Aktivspieler) optional die Summe der beiden weißen Würfel in einer beliebigen Reihe abkreuzen. Danach darf nur der Aktivspieler optional einen weißen plus einen farbigen Würfel in der passenden Farbe nutzen. Wer als Aktivspieler in seinem Zug gar kein Kreuz setzen kann/will, muss ein Fehlwurf-Feld ankreuzen.",
      },
      {
        title: "Reihe schließen",
        body: "Um das Schloss am Ende einer Reihe zu holen, braucht man mindestens 5 Kreuze in der Reihe und muss die letzte Zahl (12 bzw. 2) abkreuzen; dann ist die Reihe für alle beendet und der farbige Würfel fällt aus dem Spiel.",
      },
      {
        title: "Spielende",
        body: "Das Spiel endet, wenn jemand 4 Fehlwürfe hat oder wenn zwei Reihen geschlossen sind. Es wird sofort gewertet.",
      },
      {
        title: "Wertung",
        body: "Pro Reihe: 1 Kreuz = 1, 2 = 3, 3 = 6, 4 = 10, 5 = 15, 6 = 21, 7 = 28, 8 = 36, 9 = 45, 10 = 55, 11 = 66, 12 = 78 Punkte. Jeder Fehlwurf kostet 5 Punkte. Summe der vier Reihen minus Fehlwürfe = Gesamtergebnis. Höchste Punktzahl gewinnt.",
      },
      {
        title: "In diesem Zähler",
        body: "Trage nach Spielende (oder pro Zwischenstand) die Gesamtpunkte je Spieler ein. Bei mehreren Partien einfach weitere Runden erfassen.",
      },
    ],
  },
];

export function getTabletopGame(gameId) {
  return TABLETOP_GAMES.find((game) => game.id === gameId) || null;
}

export function wizardRoundScore(bid, tricks) {
  const b = Number(bid);
  const t = Number(tricks);
  if (!Number.isFinite(b) || !Number.isFinite(t) || b < 0 || t < 0) {
    return 0;
  }
  if (b === t) {
    return 20 + 10 * t;
  }
  return -10 * Math.abs(b - t);
}

export function wizardMaxRounds(playerCount) {
  if (playerCount < 3 || playerCount > 6) {
    return 0;
  }
  return Math.floor(60 / playerCount);
}

export function defaultPlayerNames(count) {
  return Array.from({ length: count }, (_, index) => `Spieler ${index + 1}`);
}

export function assertGamesHaveRules(games = TABLETOP_GAMES) {
  for (const game of games) {
    if (!game.blurb || !Array.isArray(game.rules) || game.rules.length === 0) {
      throw new Error(`Game ${game.id} is missing blurb/rules`);
    }
    for (const section of game.rules) {
      if (!section.title || !section.body) {
        throw new Error(`Game ${game.id} has an incomplete rules section`);
      }
    }
  }
  return true;
}
