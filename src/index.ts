/**
 * The barrel. Prefer a subpath (`luna-player/player`, `luna-player/labels`, …)
 * over this: glass-ui's barrel pulled in a dependency none of its consumers
 * wanted and broke 15 unrelated tests (§4.4). Empty until a build slot exports
 * something through it.
 */
export {};
