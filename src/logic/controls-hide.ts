/**
 * BUG-20260905-571 — when the player's controls are allowed to go.
 *
 * The transport fades on a timer and on the pointer leaving the frame, and
 * both of those had one thing they did not know about: a menu the viewer has
 * open. `MenuContent` portals into the player's container rather than into the
 * controls overlay, so a bar that fades takes its trigger with it and leaves
 * the menu standing on its own, attached to a control nobody can see and
 * nobody can press.
 *
 * The two rules are here rather than inline because the timer reads them from
 * inside a timeout it armed five seconds earlier, which is exactly the place a
 * condition written in three clauses gets one of them wrong quietly. They are
 * pure, so `controls-hide.test.ts` can hold them to it.
 */

export interface HideGuards {
  /** One of the player's own menus — quality, audio track, subtitles — is open. */
  menuOpen: boolean;
  /**
   * Something else on the player is holding the controls: the learning word
   * popover, today.
   */
  suppressed: boolean;
  /**
   * A control is focused in a way the viewer can see it is focused. Hiding
   * over it is BUG-20260820-238's stranded state — focus on a control nobody
   * can see, and every press going somewhere invisible.
   */
  controlFocused: boolean;
}

/**
 * Whether the auto-hide timer may take the controls away on this tick.
 *
 * A `false` here is not a cancellation: the caller re-arms and asks again, so
 * the controls still fade the usual few seconds after the thing holding them
 * is gone.
 */
export function controlsMayHide(guards: HideGuards): boolean {
  return !guards.menuOpen && !guards.suppressed && !guards.controlFocused;
}

/**
 * Whether the pointer leaving the frame should take the controls with it.
 *
 * It should while a film is running and nothing is open — that is the whole
 * point of the behaviour — and it must not while a menu is, because reaching a
 * menu that opens upwards is one of the ways a pointer ends up outside the
 * player in the first place.
 */
export function controlsHideOnPointerLeave(state: {
  playing: boolean;
  menuOpen: boolean;
}): boolean {
  return state.playing && !state.menuOpen;
}
