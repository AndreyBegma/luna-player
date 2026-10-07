# luna-player

The video player core from [Luna Watch](https://github.com/AndreyBegma/luna-watch), lifted
out so more than one application can mount it: HLS, controls, subtitles and
tracks, keys and gestures, the sleep timer, night mode and dialogue boost,
fullscreen and PiP, and television remote handling. Luna-specific behaviour —
progress sync, watch party, the phone remote, recommendations — stays out of
the package and plugs in through props, callbacks and slots.

Work in progress (`FEAT-20260925-718`). See the
[feature plan](https://github.com/AndreyBegma/luna-documentation/blob/main/feature-plans/FEAT-20260925-718-luna-player-package.md).

## Install

Consumed by git tag, the way [glass-ui](https://github.com/AndreyBegma/glass-ui) is —
no npm publish yet:

```
"luna-player": "github:AndreyBegma/luna-player#vX.Y.Z"
```

_Added by the L1 slot, once a tag exists to pin._

## Setup

_Added by the L3 slot: Tailwind `@source`, `transpilePackages`, `player.css`
import._

## Usage

_Added by the L3 and P1 slots: the minimal `<Player src title />` example and
the full extension-point surface._

## API

_Added by the L3 slot: `PlayerProps`, `PlayerHandle`, slots._

## Labels

_Added by the P1 slot: built-in `en` / `ru` / `uk` tables and the `labels`
override._

## Storage

_Added by the L1 slot: the `PlayerStorage` adapter and its default._

## Browser targets

Samsung S90F (Tizen, Chromium 94), Sony BRAVIA (Android TV), Safari 16+ on
iPhone/iPad, and evergreen desktop browsers. `src/targets.spec.ts` fails the
build on syntax and APIs the television does not have.

## Releasing

Tag-and-pin, as glass-ui: merge to `develop`, tag the merge commit `vX.Y.Z`,
consumers bump the pin and run `bun install`. Nobody promotes to `main` as
part of this feature.

## Licence

MIT.
