/**
 * FEAT-20260923-652 — the sleep timer: stop the film at the end of this
 * episode, or after so many minutes, whichever the viewer chose in the gear.
 *
 * Minutes are wall-clock from the moment it was set, paused time included:
 * "stop in thirty minutes" means thirty minutes from now, which is what the
 * Plex and Apple TV timers mean too.
 *
 * Like the still-watching counter it outlives the player: every episode is a
 * new mount, and a sixty-minute timer set in the first episode has to still be
 * running in the third. `sleepTimer` is the one instance the player uses; the
 * factory is what the test drives.
 */
export const SLEEP_TIMER_MINUTES = [30, 60] as const;

export type SleepChoice = 'endOfEpisode' | (typeof SLEEP_TIMER_MINUTES)[number];

export interface SleepTimerState {
  /** `null` is off. */
  choice: SleepChoice | null;
  /** Epoch ms the film stops at; `null` for off and for the end of the episode. */
  deadline: number | null;
}

export interface SleepTimer {
  /** The same object until something changes: safe for `useSyncExternalStore`. */
  get: () => SleepTimerState;
  subscribe: (listener: () => void) => () => void;
  /** `null` turns it off. Minutes count from now. */
  set: (choice: SleepChoice | null) => void;
  /**
   * The episode ended. True when the timer was waiting for exactly that, and
   * then it is spent: the viewer who presses Continue is awake.
   */
  takeEndOfEpisode: () => boolean;
  /**
   * BUG-20260924-687 — the minutes deadline passed with a player on screen:
   * off, as `set(null)` is, and remembered as the deadline that ran out, so a
   * reader of the store can tell that from the viewer choosing Off.
   */
  expire: () => void;
  /** Whether `deadline` is the one `expire` last ended. */
  expired: (deadline: number) => boolean;
}

const OFF: SleepTimerState = { choice: null, deadline: null };

export function createSleepTimer(now: () => number = Date.now): SleepTimer {
  let state = OFF;
  let expiredDeadline: number | null = null;
  const listeners = new Set<() => void>();

  const publish = (next: SleepTimerState, ranOut: number | null) => {
    state = next;
    // Recorded before anyone is told, so a listener already sees it.
    expiredDeadline = ranOut;
    for (const listener of listeners) listener();
  };

  const set = (choice: SleepChoice | null) =>
    publish(
      choice === null
        ? OFF
        : {
            choice,
            deadline:
              choice === 'endOfEpisode' ? null : now() + choice * 60_000,
          },
      null,
    );

  return {
    get: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set,
    takeEndOfEpisode: () => {
      if (state.choice !== 'endOfEpisode') return false;
      set(null);
      return true;
    },
    expire: () => publish(OFF, state.deadline),
    expired: (deadline) => deadline === expiredDeadline,
  };
}

/** What the menu shows beside a running timer: rounded up, never "0 min". */
export function minutesLeft(deadline: number, now: number): number {
  return Math.max(1, Math.ceil((deadline - now) / 60_000));
}

export type SleepStatus =
  | { kind: 'endOfEpisode' }
  | { kind: 'minutes'; minutesLeft: number };

/**
 * FEAT-20260923-652 increment 2 — what the gear's badge and the pause strip
 * both read to say a timer is armed. `null` off, the one interpretation of
 * `SleepTimerState` both call sites share rather than each re-deriving it.
 */
export function sleepStatus(state: SleepTimerState, now: number): SleepStatus | null {
  if (state.choice === null) return null;
  if (state.choice === 'endOfEpisode') return { kind: 'endOfEpisode' };
  if (state.deadline === null) return null;
  return { kind: 'minutes', minutesLeft: minutesLeft(state.deadline, now) };
}

export const sleepTimer = createSleepTimer();
