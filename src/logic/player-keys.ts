/**
 * BUG-20260820-238 — the numeric key codes televisions send for their transport
 * keys. Tizen and webOS agree on these; Android TV reports named values and is
 * covered without them.
 *
 * Deliberately excludes 85, Android's MEDIA_PLAY_PAUSE constant, because 85 is
 * the letter U on a keyboard.
 */
export const TV_KEY = {
  PLAY: 415,
  PAUSE: 19,
  STOP: 413,
  PLAY_PAUSE: 10252,
  /** FEAT-20260919-619 — Back: 461 on webOS and Tizen, 10009 on Tizen too. */
  BACK: 461,
  BACK_TIZEN: 10009,
  /** FEAT-20260923-633 — the remote's rewind and fast-forward, Tizen and webOS alike. */
  REWIND: 412,
  FAST_FORWARD: 417,
  /** FEAT-20260923-633 — Tizen's previous and next track. */
  TRACK_PREVIOUS: 10232,
  TRACK_NEXT: 10233,
} as const;

/**
 * FEAT-20260919-619 — the keys the player answers, as one table.
 *
 * `use-player-keys.ts` dispatches on `bindingFor()` and `key-sheet.tsx`
 * lists the rows that carry a `sheet` entry, so the two cannot disagree: a
 * key that is not in this table is not handled, and a key that is handled
 * is on the sheet. `keys` holds `event.key` *and* `event.code` values
 * together, the way the handler has always matched — a remote fills in
 * `key` and leaves `code` empty, a keyboard on a non-Latin layout reports
 * the letter in `key` and the position in `code`, and one list means a
 * device only has to report one. `shift` is required when `true`, forbidden
 * when `false`, and not looked at when absent.
 */
type KeyBindingId =
  | 'mediaPlayPause'
  | 'mediaPlay'
  | 'mediaPause'
  | 'mediaStop'
  | 'mediaTrackPrevious'
  | 'mediaTrackNext'
  | 'mediaRewind'
  | 'mediaFastForward'
  | 'back'
  | 'playPause'
  | 'seekBackCoarse'
  | 'seekForwardCoarse'
  | 'seekBack'
  | 'seekForward'
  | 'seekBackStep'
  | 'seekForwardStep'
  | 'up'
  | 'down'
  | 'jumpTenth'
  | 'frameBack'
  | 'frameForward'
  | 'speedDown'
  | 'speedUp'
  | 'mute'
  | 'fullscreen'
  | 'subtitles'
  | 'repeatLine'
  | 'previousEpisode'
  | 'nextEpisode'
  | 'help';

export type KeySheetGroup = 'playback' | 'seek' | 'sound' | 'picture' | 'subtitles';

export interface KeyBinding {
  id: KeyBindingId;
  keys: readonly string[];
  keyCodes?: readonly number[];
  shift?: boolean;
  /** How the `?` sheet lists it, or `null` for a key the sheet does not teach. */
  sheet: { group: KeySheetGroup; caps: readonly string[] } | null;
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const KEY_BINDINGS: readonly KeyBinding[] = [
  { id: 'mediaPlayPause', keys: ['MediaPlayPause'], keyCodes: [TV_KEY.PLAY_PAUSE], sheet: null },
  { id: 'mediaPlay', keys: ['MediaPlay'], keyCodes: [TV_KEY.PLAY], sheet: null },
  { id: 'mediaPause', keys: ['MediaPause'], keyCodes: [TV_KEY.PAUSE], sheet: null },
  { id: 'mediaStop', keys: ['MediaStop'], keyCodes: [TV_KEY.STOP], sheet: null },
  {
    id: 'mediaTrackPrevious',
    keys: ['MediaTrackPrevious'],
    keyCodes: [TV_KEY.TRACK_PREVIOUS],
    sheet: null,
  },
  { id: 'mediaTrackNext', keys: ['MediaTrackNext'], keyCodes: [TV_KEY.TRACK_NEXT], sheet: null },
  { id: 'mediaRewind', keys: ['MediaRewind'], keyCodes: [TV_KEY.REWIND], sheet: null },
  {
    id: 'mediaFastForward',
    keys: ['MediaFastForward'],
    keyCodes: [TV_KEY.FAST_FORWARD],
    sheet: null,
  },
  {
    id: 'back',
    keys: ['Escape', 'GoBack', 'BrowserBack'],
    keyCodes: [TV_KEY.BACK, TV_KEY.BACK_TIZEN],
    sheet: { group: 'picture', caps: ['Esc'] },
  },
  {
    id: 'playPause',
    keys: ['Enter', 'Space', ' ', 'KeyK', 'k', 'K'],
    sheet: { group: 'playback', caps: ['Space', 'K'] },
  },
  { id: 'seekBackCoarse', keys: ['ArrowLeft'], shift: true, sheet: null },
  {
    id: 'seekForwardCoarse',
    keys: ['ArrowRight'],
    shift: true,
    sheet: { group: 'seek', caps: ['Shift', '←', '→'] },
  },
  { id: 'seekBack', keys: ['ArrowLeft'], sheet: null },
  { id: 'seekForward', keys: ['ArrowRight'], sheet: { group: 'seek', caps: ['←', '→'] } },
  { id: 'seekBackStep', keys: ['KeyJ', 'j', 'J'], sheet: null },
  { id: 'seekForwardStep', keys: ['KeyL', 'l', 'L'], sheet: { group: 'seek', caps: ['J', 'L'] } },
  { id: 'up', keys: ['ArrowUp'], sheet: null },
  { id: 'down', keys: ['ArrowDown'], sheet: { group: 'sound', caps: ['↑', '↓'] } },
  {
    id: 'jumpTenth',
    keys: [...DIGITS, ...DIGITS.map((d) => `Digit${d}`), ...DIGITS.map((d) => `Numpad${d}`)],
    sheet: { group: 'seek', caps: ['0', '…', '9'] },
  },
  { id: 'frameBack', keys: [',', 'Comma'], shift: false, sheet: null },
  {
    id: 'frameForward',
    keys: ['.', 'Period'],
    shift: false,
    sheet: { group: 'seek', caps: [',', '.'] },
  },
  { id: 'speedDown', keys: ['<', 'Comma'], shift: true, sheet: null },
  {
    id: 'speedUp',
    keys: ['>', 'Period'],
    shift: true,
    sheet: { group: 'playback', caps: ['<', '>'] },
  },
  { id: 'mute', keys: ['KeyM', 'm', 'M'], sheet: { group: 'sound', caps: ['M'] } },
  { id: 'fullscreen', keys: ['KeyF', 'f', 'F'], sheet: { group: 'picture', caps: ['F'] } },
  { id: 'subtitles', keys: ['KeyC', 'c', 'C'], sheet: { group: 'subtitles', caps: ['C'] } },
  { id: 'repeatLine', keys: ['KeyR', 'r', 'R'], sheet: { group: 'subtitles', caps: ['R'] } },
  // FEAT-20260923-633 — Shift is required, so a bare N or P stays free.
  { id: 'previousEpisode', keys: ['KeyP', 'p', 'P'], shift: true, sheet: null },
  {
    id: 'nextEpisode',
    keys: ['KeyN', 'n', 'N'],
    shift: true,
    sheet: { group: 'playback', caps: ['Shift', 'P', 'N'] },
  },
  { id: 'help', keys: ['?', 'Slash'], shift: true, sheet: { group: 'picture', caps: ['?'] } },
];

/**
 * The binding a key event names, or `null` for a key the player does not answer.
 *
 * FEAT-20260923-661 Q-02 — what the key *says* wins over where it *sits*: a row
 * matching `key` (or a television's `keyCode`) beats a row matching only
 * `code`. In one pass the table order decided instead, and on the Russian and
 * Ukrainian layouts `?` — Shift+7, `code: 'Digit7'` — landed on `jumpTenth`
 * before `help` and threw the viewer to 70 % of the film. `code` is the
 * fallback for a layout whose `key` is a letter the table does not list.
 *
 * FEAT-20260923-661 Q-01 — a chord with Ctrl, Cmd or Alt is the browser's.
 * Nothing in the table needs one on any layout Luna ships, and no remote sets
 * them; answering them took Ctrl+C for subtitles, Ctrl+1…9 for a seek and
 * Alt+← / Alt+→ away from history navigation.
 */
export function bindingFor(event: {
  key: string;
  code: string;
  keyCode: number;
  shiftKey: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}): KeyBinding | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const key = event.key || '';
  const code = event.code || '';
  const candidates = KEY_BINDINGS.filter(
    (b) => b.shift === undefined || b.shift === event.shiftKey,
  );
  return (
    candidates.find((b) => b.keys.includes(key) || b.keyCodes?.includes(event.keyCode)) ??
    candidates.find((b) => b.keys.includes(code)) ??
    null
  );
}

/**
 * FEAT-20260923-633 — the rows the `?` sheet lists under `group`.
 *
 * The episode keys are listed only on an episode: on a film they are
 * unbound, and a sheet that teaches a key that does nothing is the thing
 * the shared table exists to prevent. BUG-20260925-705 — the same for R,
 * which repeats a line only in learning mode, and learning mode cannot be
 * turned on where English is switched off (`lib/english/enabled.ts`).
 */
export function sheetRows(
  group: KeySheetGroup,
  { hasEpisodes, hasLearning }: { hasEpisodes: boolean; hasLearning: boolean },
): KeyBinding[] {
  return KEY_BINDINGS.filter(
    (b) =>
      b.sheet?.group === group &&
      (hasEpisodes || b.id !== 'nextEpisode') &&
      (hasLearning || b.id !== 'repeatLine'),
  );
}

/** Which tenth of the film a digit key asks for, `null` when it is not one. */
export function tenthFor(event: { key: string; code: string }): number | null {
  const fromKey = DIGITS.indexOf(event.key || '');
  if (fromKey !== -1) return fromKey;
  const match = /^(?:Digit|Numpad)(\d)$/.exec(event.code || '');
  return match ? Number(match[1]) : null;
}

/**
 * BUG-20260823-368 — is anybody using this player: is it fullscreen, or does
 * focus sit inside it? The rationale is at the guard in `use-player-keys.ts`.
 *
 * FEAT-20260923-661 Q-08 — one copy, because the bubble-phase handler and
 * Back's capture-phase listener (`use-back-capture.ts`) must agree on it.
 */
export function playerInUse(container: HTMLElement | null, fullscreenActive: boolean): boolean {
  return fullscreenActive || Boolean(container?.contains(document.activeElement));
}

/**
 * FEAT-20260919-619 — whether Back is the player's to answer.
 *
 * On a television Back hides the controls first; a second Back with them
 * already down leaves the player as it always has — `lib/tv/use-tv-input.ts`
 * closes an open surface or leaves the page, and Escape leaves pseudo
 * fullscreen. The root walker sees the key first in the bubble phase, so the
 * player listens in the capture phase and takes the press only when this
 * says so; everything else it leaves untouched, in the same order as before.
 * A menu or the key sheet is a Radix surface, and Back is theirs to close.
 */
export function backHidesControls(state: {
  televisionClass: boolean;
  inUse: boolean;
  showControls: boolean;
  menuOpen: boolean;
  sheetOpen: boolean;
}): boolean {
  return (
    state.televisionClass &&
    state.inUse &&
    state.showControls &&
    !state.menuOpen &&
    !state.sheetOpen
  );
}

/**
 * BUG-20260820-236 — is a control holding focus right now?
 *
 * A TV remote drives everything through focus, and Enter, Space and the arrows
 * all belong to the focus system while a control has it: Enter and Space
 * activate the focused control by themselves, and the arrows move between
 * controls. Acting on them in the player's own handler as well is what made one
 * press of OK on the play/pause button toggle playback twice — once from the
 * key handler and once from the button's own click, which the DOM dispatches
 * for Enter on a focused button — leaving playback exactly where it started.
 *
 * Lives outside the component because it reads the document and nothing else;
 * as a closure it would be rebuilt every render for no reason.
 */
export function controlHasFocus(): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body) return false;
  return Boolean(
    active.closest('button, input, select, textarea, [data-player-control]'),
  );
}

/**
 * FEAT-20260830-489 — is a control holding focus that owns the *arrows*?
 *
 * A narrower question than `controlHasFocus()` above, and the two are both
 * needed rather than one replacing the other.
 *
 * `controlHasFocus()` answers "would acting on this key press double up with
 * the focused control's own handling?", which is true of Enter and Space on any
 * button — that is BUG-20260820-236, where one press of OK on the play button
 * toggled playback twice and left it exactly where it started. It still guards
 * those two keys, and it still keeps the controls from hiding under a focused
 * control.
 *
 * The arrows are a different matter. Until now they were guarded by the same
 * broad test, so on a television — where a control is focused almost all the
 * time the controls are up — the viewer could not seek at all: ArrowRight was
 * handed to the focus system while the Play button happened to hold focus.
 * Seeking is the single most reached-for thing in a player, and it is what
 * ArrowRight means to everyone.
 *
 * So only the controls that genuinely need the arrows keep them: a text field
 * moving a caret, a `range` or a `role="slider"` changing its own value — the
 * scrubber, after this feature — and an open menu roving between its items.
 * Everything else lets the arrows through to the player.
 */
export function arrowOwnerHasFocus(): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body) return false;
  return Boolean(
    active.closest(
      'input, select, textarea, [role="slider"], [role="menu"], [role="menuitem"], [role="listbox"], [role="combobox"], [contenteditable="true"]',
    ),
  );
}

/**
 * FEAT-20260919-619 — the same question for Up and Down alone.
 *
 * The scrubber is a `role="slider"` that implements the horizontal axis and
 * nothing else — Left, Right, Home and End — so `arrowOwnerHasFocus()`
 * handing it Up and Down as well stranded a remote on it: once focus landed
 * on the scrubber there was no key that left it. A native `<input
 * type="range">` (the volume) does move on Up and Down and keeps them.
 */
export function verticalArrowOwnerHasFocus(): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body) return false;
  return Boolean(
    active.closest(
      'input, select, textarea, [role="menu"], [role="menuitem"], [role="listbox"], [role="combobox"], [contenteditable="true"]',
    ),
  );
}

/**
 * FEAT-20260830-489 — is a control holding focus *the viewer can see*?
 *
 * The auto-hide timer needs this rather than `controlHasFocus()`, and the
 * difference is a mouse.
 *
 * Chrome focuses a `<button>` on click. So "never hide the controls while a
 * control has focus" — which is right for a remote, whose focus is the only
 * thing telling the viewer where they are — would, on a desktop, pin the whole
 * transport on screen for the rest of the film the moment anybody pressed play.
 *
 * `:focus-visible` is exactly the distinction the platform already draws: set
 * for a keyboard or a remote, not for a pointer. It is also the selector
 * `globals.css` hangs the focus ring on, so this asks the same question the
 * viewer is answering with their eyes — is there a ring on screen?
 *
 * Where the selector is not supported, a coarse pointer is the fallback answer:
 * a device with no mouse is being driven by something whose focus must not move
 * out from under it.
 */
export function controlHasKeyboardFocus(coarsePointer: boolean): boolean {
  if (!controlHasFocus()) return false;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  try {
    return active.matches(':focus-visible');
  } catch {
    return coarsePointer;
  }
}
