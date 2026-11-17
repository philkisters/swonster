# Swonster

Ein browserbasiertes Monster-Merge-Spiel mit Nuxt, Vue und TypeScript.

## Entwicklung

```bash
pnpm install
pnpm dev
```

## Tests und Prüfung

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

## GitHub Pages

GitHub Pages is deployed from the default branch by
`.github/workflows/deploy-pages.yml`. In the repository settings, set **Pages**
to use **GitHub Actions** as its source. The generated static files can also be
built locally with `pnpm generate`.

## Phase 1

Das 5×5-Board startet mit fest platzierten verbündeten Monstern und Gegnern. Beim Laden erklärt ein Tutorial Bewegung, Angriffe, Konter und die Spawn-Vorschau; nach Bestätigung können alle beweglichen Monster mit Pfeiltasten, WASD oder einer Wischbewegung bewegt werden. Gleiche Monster derselben Fraktion und Stufe verschmelzen beim Schieben; Gegner und unbewegliche Monster blockieren den Weg. Die Spielregeln liegen als reine TypeScript-Funktionen im Ordner `game/`.

## Phase 3

Nach Bewegung und Verschmelzen greifen Monster das gegnerische Monster im direkt angrenzenden Feld in Zugrichtung an. Aktive Angriffe werden gleichzeitig verrechnet; überlebende, beschädigte Verteidiger kontern, sofern sie nicht selbst angegriffen haben. Ein besiegter Gegner der Stufe 1 gewährt 5 Score, 1 Gold und 2 XP; der Score verdreifacht sich pro weiterer Stufe, Gold und XP bleiben gleich. Das Verschmelzen zweier verbündeter Monster der Stufe 1 gewährt 3 Score; dieser Wert verdoppelt sich pro weiterer Stufe der Ausgangsmonster. Gegnerverschmelzungen gewähren keinen Score. Die Werte sind konfigurierbar in `game/config.ts`.

## Phase 4

Die Vorschau zeigt zehn deterministische Spawns pro Lauf. Nach jedem gültigen Zug wird, sofern ein Feld frei ist, genau der erste Eintrag gespawnt und die Vorschau um einen Eintrag weitergeschoben; ungültige Züge ändern sie nicht. Der Zufall wird mit einem Run-Seed initialisiert und für reproduzierbare Tests kontrolliert.

Freundliche Monster erscheinen immer auf Stufe 1, mit einer Wahrscheinlichkeit von 30 %. Gegner erscheinen zunächst ebenfalls auf Stufe 1. Sobald erstmals zwei verbündete Monster zu einem Monster der Stufe 3 verschmolzen sind, wachsen die Wahrscheinlichkeiten für Gegner der Stufen 2, 3 und 4 pro gültigem Zug um 0,3, 0,15 beziehungsweise 0,05 Prozentpunkte, bis maximal 30 %, 20 % beziehungsweise 10 % erreicht sind. Die restliche Wahrscheinlichkeit entfällt auf Stufe 1. Bereits angezeigte Einträge bleiben unverändert; die Entwicklung gilt für neu hinzugefügte Vorschau-Einträge. Die Werte und Monstertypen sind in `game/config.ts` konfigurierbar; Boss-Spawns sind noch nicht Teil der Standardverteilung. Monster erscheinen in einem zufällig ausgewählten freien Feld. Die Platzierung verwendet denselben Run-Seed und ist deshalb reproduzierbar.

## Phase 5

Das Spiel endet, wenn nach einem gültigen Zug für den nächsten Spawn kein Feld frei ist oder nach dem Spawn keine verbündeten Monster mehr übrig sind. Ein freundlicher Spawn kann den Verlust des letzten Verbündeten ausgleichen. Ein Spawn, der das letzte freie Feld belegt, beendet das Spiel nicht allein deshalb: Ein späterer Zug kann wieder Platz schaffen. Ungültige Züge versuchen keinen Spawn und lösen daher kein Game-over aus. Nach dem Spielende zeigt eine Einblendung über dem Spielfeld den Score. Bei vollem Spielfeld oder nach dem Spielende kann mit „Neues Spiel“ der Startzustand samt Spawn-Vorschau zurückgesetzt werden.
