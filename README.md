# luna-player

**The video player core of Luna Watch, as a React package any app can mount.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Discord](https://img.shields.io/badge/Discord-join%20the%20community-5865F2?logo=discord&logoColor=white)](https://discord.gg/mkQARkBs4C)

A good streaming player is mostly behaviour, not markup: when the controls
hide, what a double tap on the left third does, how a TV remote's rewind key
is reported on Tizen versus webOS, when to offer "continue from 41:12", how
the sleep timer fades the volume out. luna-player lifts that behaviour out of
the Luna Watch app into one tested package, so a second application gets the
same player instead of a copy that drifts.

**Who it is for:** React 19 applications that play HLS video on phones,
desktops and televisions (Samsung Tizen, Android TV) and want Luna's player
behaviour without Luna's product features. Progress sync, watch party, the
phone remote and recommendations stay in the host app.

> **Status: work in progress.** Today the package ships the player's logic,
> the platform helpers and the labels seam — pure functions and small hooks,
> each importable on its own. The `<Player>` component, its stylesheet, the
> storage adapter and the playhead store are listed in `package.json`
> `exports` but are **not in the package yet**; importing those subpaths
> fails until they land.

## What is in the package today

**Logic** (`src/logic/`, every module has its own tests)

- **Controls and transport** — when the controls may hide
  (`controls-hide`), whether the centre transport shows
  (`centre-transport-visibility`), the elapsed/remaining clock
  (`clock-mode`, `format-time`).
- **Seeking and gestures** — seek bar geometry and arrow-key seeking
  (`seek-geometry`), hold-to-seek steps that grow the longer a key is held (`hold-seek`), double tap on
  the left, centre or right third (`frame-tap`), long press for 2x speed
  (`long-press`), playback speed steps (`playback-rate`).
- **Keyboard and remote** — one table of every key the player answers, with
  the Tizen and webOS remote key codes and the rows for the `?` key sheet
  (`player-keys`).
- **Sound** — night mode and dialogue boost on a Web Audio graph
  (`audio-graph`, `sound-mode`), saved volume and wheel volume
  (`saved-volume`, `volume-wheel`), audio track names (`audio-track-labels`).
- **Picture and subtitles** — fit modes for letterboxed video
  (`video-fit`), subtitle size, background and position (`subtitle-appearance`).
- **Session** — the resume offer (`resume-policy`), end of stream and a
  stall at the tail (`end-of-stream`), the sleep timer and its volume fade
  (`sleep-timer`, `sleep-fade`), "still watching?" after several episodes in
  a row (`still-watching`), the intro and outro ranges behind Skip intro and Skip outro (`episode-range`).

**Platform** (`src/platform/`)

- **TV spatial navigation** — pick the next focusable element in a
  direction (`tv-spatial`) and collect and focus candidates in the DOM
  (`tv-focusables`).
- **Media queries** — `useMediaQuery` with the `TELEVISION` and `COMPACT`
  queries the player lays out by (`media-query`).
- **Audio track language** — resolve a track's language and pick the
  default track from the account locale (`audio-track-language`).

**Labels** (`luna-player/labels`)

- `LabelsProvider` and `useLabels()` — every string the player renders comes
  from a plain `PlayerLabels` object supplied by the host, so the package
  does not depend on an i18n library. Strings that take a parameter are
  functions, so a caller cannot forget the parameter.

## Install

Not published to npm. Pin a git tag, the same way the host apps consume
[glass-ui](https://github.com/AndreyBegma/glass-ui):

```json
"luna-player": "github:AndreyBegma/luna-player#v0.1.1"
```

Peer dependencies: `react` and `react-dom` 19, `glass-ui` (>= 0.1.0),
`lucide-react` (>= 0.400.0), `motion` (>= 12), `tailwindcss` 4, and
optionally `hls.js` 1.5+. The package ships TypeScript source (`main` is
`src/index.ts`), so the host's bundler compiles it.

## Usage

Import from a subpath. The root barrel is intentionally empty, so an app
only pulls in what it uses.

```ts
import { formatTime, formatRemaining } from 'luna-player/format-time';
import { bindingFor } from 'luna-player/player-keys';
import { createSleepTimer } from 'luna-player/sleep-timer';

formatTime(3725); // "1:02:05"
formatRemaining(60, 3725); // "−1:01:05"

window.addEventListener('keydown', (event) => {
  const binding = bindingFor(event); // also matches TV remote key codes
  if (binding?.id === 'playPause') togglePlayback();
});

const sleep = createSleepTimer();
sleep.set(30); // minutes from now; 'endOfEpisode' or null also work
```

Labels:

```tsx
import { LabelsProvider, type PlayerLabels } from 'luna-player/labels';

const labels: PlayerLabels = {
  ariaPlay: 'Play',
  trackN: (n) => `Track ${n}`,
  continueFrom: (time) => `Continue from ${time}`,
  // ... every key in src/labels/types.ts
};

<LabelsProvider labels={labels}>{children}</LabelsProvider>;
```

## Browser targets

Samsung S90F (Tizen, Chromium 94), Sony BRAVIA (Android TV), Safari 16+ on
iPhone and iPad, and evergreen desktop browsers. There is no down-levelling
step, so [`src/targets.spec.ts`](src/targets.spec.ts) fails the tests on
syntax and APIs Chromium 94 does not have (`findLast`, `color-mix()`,
`@starting-style`, view transitions, scroll timelines).

## Development

Requires [Bun](https://bun.sh).

```sh
bun install
bun run lint          # Biome
bun run typecheck     # tsc
bun run test          # bun test, with a happy-dom DOM preloaded
bun run build:check   # bundle src/index.ts for the browser as a smoke check
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the same four
steps on every pull request and on pushes to `develop` and `main`.

## Releasing

Tag-and-pin, as glass-ui: merge to `develop`, tag the merge commit `vX.Y.Z`,
consumers bump the pin and run `bun install`.

## License

[MIT](LICENSE)
