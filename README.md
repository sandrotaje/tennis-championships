# Tennis Championships

A modern browser remake of the old GameDesign/Tennis Championships Flash tennis game.

The goal is to preserve the original design: tiny players, one-button strokes, timing-based depth, directional aiming, a surprisingly capable CPU, and a 16-player tournament.

## Controls

- **Arrow keys** — move; while swinging, influence shot direction/depth
- **Space** — toss / serve / swing
- **Esc** — pause
- **Enter / Space** — confirm menu selections

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

The game is deliberately implemented on Canvas without a physics engine. Ball flight, bounce, player reach and CPU decisions are deterministic game logic so the feel can be tuned toward the original Flash game.

## Reverse-engineering notes

The recovered game is an ActionScript 2 / Flash 7 title. The preserved roster encodes six one-digit attributes in front of each player name. This remake interprets them as:

`forehand, backhand, serve, footwork, netplay, tech`

Match format follows the original: first player to 3 games, win by two.
