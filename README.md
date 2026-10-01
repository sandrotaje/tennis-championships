# Tennis Championships

Native TypeScript and Canvas 2D reconstruction of the supplied Tennis Championships game. No Flash player, Ruffle, WebAssembly emulator, or SWF is loaded by the application.

The original vector artwork was converted offline into SVG images in `public/art`. Animated players use individually exported animation frames. Original fonts are ordinary browser assets. The game runs without audio. The original SWF in `assets` is retained only as source reference; it is excluded from the production bundle.

`src/game.ts` implements the simulation at 30 Hz, including keyboard movement, serving, shots, gravity, bounces, computer opponent, service faults, tennis scoring, and match progression. `src/main.ts` implements the menus, exhibition settings, sixteen-player tournament, input, and Canvas rendering. There is no ActionScript interpreter.

## Run

```sh
npm ci
npm run dev
```

Arrow keys move and aim, Space tosses/strikes the ball and advances screens, Escape returns to the menu. A serve takes two presses: toss, then strike near the top of the toss. The exhibition skill bars are clickable. Touch controls are intentionally absent.

## Validate and build

```sh
npm test
npm run build
npm run preview
```

Publish `dist`. The build needs only Node.js; the offline Flash extraction tools are not involved. The reconstruction uses the original artwork and timing reference, while gameplay behavior is implemented independently and still needs comparison through complete matches to establish exact parity.
