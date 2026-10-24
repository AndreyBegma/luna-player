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

> **Status: work in progress.** The package ships a first `<Player>`
> (`luna-player/player`, its stylesheet `luna-player/player.css`, and the
> hls.js loader `luna-player/hls`), the player's logic, the platform helpers
> and the labels seam. The `/types`, `/storage` and `/playhead` subpaths are
> **not in the package yet**; the Player's own types and the
> `localStoragePlayerStorage` adapter are exported from `luna-player/player`
> until then.

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
- `en` — the built-in English, Luna Watch's own strings.

**Player** (`luna-player/player`, `luna-player/player.css`, `luna-player/hls`)

- `<Player>` — the first slice of Luna Watch's player. See [Player](#player).

## Install

```sh
bun add luna-player
bun add react react-dom @andrewbehma/glass-ui lucide-react motion tailwindcss
bun add hls.js   # optional peer
```

Peer dependencies: `react` and `react-dom` 19,
[`@andrewbehma/glass-ui`](https://www.npmjs.com/package/@andrewbehma/glass-ui)
(>= 0.20.0), `lucide-react` (>= 0.400.0), `motion` (>= 12), `tailwindcss` 4,
and optionally `hls.js` 1.5+. The package ships compiled ES modules with
their `.d.ts` files (`dist/`), one file per source module, so deep imports
tree-shake.

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

## Player

`<Player>` is **extracted from Luna Watch**, not written fresh: the core of
its `VideoPlayer`, with the same markup, Tailwind classes, gestures and keys,
and the app's own features left out. This first slice plays a progressive
MP4 or WebM (or HLS, see below) with play/pause, the seek bar, the clock,
volume, speed and fullscreen.

### Install

```sh
bun add luna-player
bun add react react-dom @andrewbehma/glass-ui lucide-react motion tailwindcss
bun add @radix-ui/react-slider @radix-ui/react-tooltip   # Glass UI's, needed by the player
bun add hls.js   # optional, only for hlsSrc
```

The player uses Glass UI's `slider`, `tooltip`, `badge`, `button` and `card`.
The two Radix packages are Glass UI's peers, and the player needs them
installed.

### Styles

The components are styled with Tailwind utility classes and Glass UI tokens.
Import the player's stylesheet **from your Tailwind entry CSS**, after Glass
UI's imports:

```css
/* app/globals.css */
@import "tailwindcss";
@import "@andrewbehma/glass-ui/tokens.css";
@import "@andrewbehma/glass-ui/material.css";
@import "@andrewbehma/glass-ui/base.css";
@import "luna-player/player.css";
```

`player.css` carries `@source "."`, which points your Tailwind build at the
player's compiled components in `node_modules/luna-player/dist/player/`, so
the classes they use are generated. A JavaScript `import 'luna-player/player.css'`
skips your Tailwind build and is **not supported**: the classes would be
missing. `bun run smoke` checks this against the packed tarball.

### Example

```tsx
'use client';
import { Player } from 'luna-player/player';

<Player
  src="/videos/demo.mp4"
  poster="/videos/demo.jpg"
  aspectRatio="9:16"
  onError={() => showFallback()}
/>;
```

It renders on the server (Next.js App Router included). Every module is
`'use client'`, and nothing reads `window`, `document` or storage at import
or in render.

### Props

| Prop | Type | Default | |
|---|---|---|---|
| `src` | `string` | — | Progressive source (MP4, WebM), over HTTP Range. Attached on the first play. |
| `fallbackSrc` | `string` | — | Tried once when the element refuses `src`. |
| `hlsSrc` | `string` | — | A manifest. Driven by hls.js only with `loadHls`; Safari plays it natively. |
| `loadHls` | `HlsLoader` | — | Pass `loadHls` from `luna-player/hls`. |
| `hlsLoading` | `{ firstByteTimeoutMs, forwardBufferSeconds }` | hls.js's own | How patient hls.js is. |
| `poster` | `string` | — | |
| `title` | `string` | `labels.ariaPlay` | The idle play button's accessible name. |
| `aspectRatio` | `'16:9' \| '9:16' \| '1:1' \| \`${number}/${number}\`` | `'16:9'` | The frame's shape. Fullscreen fills the screen. |
| `onError` | `(error: { kind: 'playback' }) => void` | — | Once per source, when playback fails for good: the element erred with no fallback left, or hls.js stayed fatal after its recovery. The frame shows a notice with Retry. |
| `autoPlay` | `boolean` | `false` | A `play()` the browser refuses is not an error. |
| `locale` | `string` | `'en'` | For audio-track names. |
| `labels` | `Partial<PlayerLabels>` | — | Merged over the built-in English (`en`). |
| `storage` | `PlayerStorage \| null` | `localStoragePlayerStorage('luna-player:')` | Where volume and speed are kept. `null` keeps nothing. |
| `onVideoElement` | `(element: HTMLVideoElement \| null) => void` | — | The `<video>` itself. |
| `className` | `string` | — | On a wrapper around the frame. |

A new `src`, `hlsSrc` or `fallbackSrc` starts the player afresh: the
fallback hop, the error and `onError` all start over with the new source.

The `ref` is a `PlayerHandle`: `play()`, `pause()`, `seekTo(seconds)`,
`getTime()` and `startFullscreen()`.

### Why `loadHls` is a prop

Turbopack, webpack and Vite resolve a string-literal `import('hls.js')` at
**build** time. If the player held one, a host without the optional peer
would fail its build. So the player takes a loader, and `luna-player/hls` is
the one module that names hls.js:

```tsx
import { Player } from 'luna-player/player';
import { loadHls } from 'luna-player/hls';

<Player src="/films/a.mp4" hlsSrc="/films/a.m3u8" loadHls={loadHls} />;
```

Without `loadHls`, `hlsSrc` plays only where the browser plays HLS itself,
and `src` everywhere else.

### Storage

`storage` takes a `PlayerStorage` (`get`, `set`, `remove`). The default,
`localStoragePlayerStorage(prefix)`, keeps keys such as
`luna-player:volume` and `luna-player:speed`. It touches `localStorage` only
when it is called, inside a `try`, so a browser that refuses site storage
still plays. The elapsed/remaining clock choice keeps its own `luna:clock`
key, as `luna-player/clock-mode` does today.

### Keyboard

The keys work while focus is inside the player (or in fullscreen), as in
Luna Watch: `Space`/`K`/`Enter` play or pause, `←`/`→` seek 10 s (hold to
go faster), `Shift`+`←`/`→` 60 s, `J`/`L` 10 s, `↑`/`↓` volume while the
controls are hidden, `M` mute, `F` fullscreen, `<`/`>` speed, `0`–`9` jump
to a tenth, `,`/`.` step a frame while paused, `Esc` hides the controls and
leaves fullscreen. TV remote media keys are handled too. The full table is
`luna-player/player-keys`.

### Bundle

`luna-player/player` is 65.6 kB minified with every peer external (Bun
1.4.0, measured by `src/player/bundle.test.ts`, which fails above
72.1 kB and if any hls.js code reaches the bundle).

### Not in this slice

The audio-track and dub menu, subtitles and their menus, quality and the
settings gear, picture fit, sound modes, the sleep timer, picture-in-picture,
stream warmup; episodes (now playing, previous/next, skip intro/outro, the
end screen, "still watching?"), the resume banner; Luna's learning mode,
cast and play-on-TV, the phone remote, the pause strip, the brand intro,
progress sync and server seek; the TV layout and the `?` key sheet; slots,
`usePlayer()`, `onStateChange` and the rest of the handle; built-in `ru` and
`uk` labels.

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
bun run build         # tsc into dist/: one .js + .d.ts per module
bun run smoke         # pack the tarball and import every export from it
bun test scripts/release   # the release pipeline's decision scripts
```

`bun run build` (`scripts/build.ts`) runs `tsc -p tsconfig.build.json`,
copies every `.css` under `src/` into `dist/`, and rewrites extensionless
relative specifiers to the file they name (`'./context'` →
`'./context.js'`); a specifier that names nothing fails the build.

`bun run smoke` runs after `bun run build`. It packs the package with
`npm pack`, unpacks the tarball under `.smoke/` and checks it as a consumer
would see it:

- the tarball holds only `dist/`, `README.md`, `LICENSE` and `package.json`;
- every `exports` target exists;
- every built file whose source starts with `'use client'` starts with it
  too;
- every JS subpath imports under Node with `--conditions=import` (types-only
  modules and the empty root barrel only have to import; the rest must
  export something).

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs all of these
on every pull request and on pushes to `develop` and `main`.

## Releasing

The version in `package.json` is the release. Merging a version bump into
`main` publishes it to npm as `luna-player` and tags it; there is
no manual step.

1. Branch `release/vX.Y.Z` from `develop`, set `"version": "X.Y.Z"` in
   `package.json`, and open a pull request into `main`.
2. Merge it into `main`.
3. [`.woodpecker/release.yml`](.woodpecker/release.yml) does the rest. On the
   push to `main` it installs, lints, typechecks, tests, builds and
   smoke-tests, then runs `npm publish` if X.Y.Z is not on npm yet, and pushes
   the tag `vX.Y.Z`. A push to `main` without a version bump publishes nothing
   and passes.

`v0.1.0` and `v0.1.1` are git tags from before the package was on npm, so the
first npm release has to be a version above 0.1.1: the tag step cannot push a
`vX.Y.Z` that already exists.

The tag push still works and is idempotent. Pushing `vX.Y.Z` yourself checks the
tag against `package.json` (a mismatch fails before anything is built) and
publishes that version; a version that is already on npm passes without
publishing again, which is also what the tag the pipeline pushes itself does.
When the registry has not caught up with a publish yet, the tag pipeline tries
again and gets a 409; `scripts/release/publish.sh` treats that as published.

**Maint lines never take `latest`.** A push to a `maint/*` branch (for example
`maint/v0.1`), or any version below the current `latest`, is published with
`npm publish --tag v<major>.<minor>` (`v0.1` for 0.1.9), so it cannot move the
`latest` dist-tag. `scripts/release/decide.sh` makes that decision and
`scripts/release/decide.test.ts` covers it. After a release, check with
`npm view luna-player dist-tags`.

**Woodpecker setup.** The `AndreyBegma/luna-player` repository must be
activated in Woodpecker, and two secrets must exist on it:

- `npm_token` — an npm token that can publish `luna-player`,
  available to the `push`, `tag` and `manual` events. Without `push` the
  publish step says so and passes.
- `github_token` — a token with contents write on this repository, available
  to `push` only. Without it the tag step says so and passes, and the tag is
  pushed by hand: `git tag vX.Y.Z && git push origin vX.Y.Z`.

**The tag follows the publish step's decision, not the registry.** The publish
step records `publish=yes|no` and `version` in `.release/decision`; the tag step
reads it (`scripts/release/should-tag.sh`, covered by `should-tag.test.ts`)
because `npm view` can still miss a version published a second earlier.
Published now: tag. Already published and no tag yet (a re-run): tag. Already
published and tagged (no version bump), or no decision recorded: no tag.

To rehearse without a tag, start a manual pipeline in Woodpecker with
`[luna-release]` in its message. It runs the same steps and ends in
`npm publish --dry-run`. A manual run without that marker does not start the
release workflow.

## License

[MIT](LICENSE)
