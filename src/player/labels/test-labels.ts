import { en } from '../../labels/en';
import type { PlayerLabels } from '../../labels/types';

/**
 * FEAT-20260925-718 L3 — the fixture the lifted `core/**` tests import as
 * `./labels/test-labels`. In luna-watch it is built from `messages/en.json`;
 * here that table is the package's own `en`, so the tests keep their import
 * and read the very strings the player ships with.
 */
export const TEST_LABELS: PlayerLabels = en;
