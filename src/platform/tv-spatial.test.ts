import { describe, expect, it } from 'bun:test';

import { type NavCandidate, nextInDirection } from './tv-spatial';

/** A poster-sized box, named so a failure says which one was picked. */
function box(
  name: string,
  left: number,
  top: number,
  section: string | null = null,
  width = 160,
  height = 240,
): NavCandidate<string> {
  return {
    ref: name,
    section,
    rect: { left, top, right: left + width, bottom: top + height },
  };
}

/** Two poster rows of three, the shape of the home page. */
const rowA = [
  box('a1', 0, 0, 'row-a'),
  box('a2', 200, 0, 'row-a'),
  box('a3', 400, 0, 'row-a'),
];
const rowB = [
  box('b1', 0, 300, 'row-b'),
  box('b2', 200, 300, 'row-b'),
  box('b3', 400, 300, 'row-b'),
];
const home = [...rowA, ...rowB];

const pick = (
  from: NavCandidate<string>,
  direction: 'up' | 'down' | 'left' | 'right',
) => nextInDirection(from, home, direction)?.ref ?? null;

describe('nextInDirection', () => {
  it('steps to the neighbour along a row', () => {
    expect(pick(rowA[0], 'right')).toBe('a2');
    expect(pick(rowA[1], 'right')).toBe('a3');
    expect(pick(rowA[2], 'left')).toBe('a2');
  });

  it('stops at the end of a row rather than leaving the section sideways', () => {
    expect(pick(rowA[2], 'right')).toBeNull();
    expect(pick(rowA[0], 'left')).toBeNull();
  });

  it('crosses to the next row on the vertical axis', () => {
    expect(pick(rowA[0], 'down')).toBe('b1');
    expect(pick(rowB[2], 'up')).toBe('a3');
  });

  it('keeps the column when it crosses, rather than the nearest corner', () => {
    expect(pick(rowA[1], 'down')).toBe('b2');
    expect(pick(rowB[1], 'up')).toBe('a2');
  });

  it('never answers with something level with the origin', () => {
    expect(pick(rowA[1], 'up')).toBeNull();
    expect(pick(rowB[1], 'down')).toBeNull();
  });

  it('prefers an aligned element to a nearer misaligned one', () => {
    // `near` is closer to `origin` by raw distance but shares none of its
    // vertical extent; `far` sits squarely to its right. The row wins.
    const origin = box('origin', 0, 0, null, 100, 40);
    const near = box('near', 110, 300, null, 100, 40);
    const far = box('far', 400, 0, null, 100, 40);
    expect(nextInDirection(origin, [near, far], 'right')?.ref).toBe('far');
  });

  it('governs a sectionless element by geometry alone, on both axes', () => {
    const a = box('a', 0, 0, null, 100, 40);
    const b = box('b', 200, 0, null, 100, 40);
    const c = box('c', 0, 100, null, 100, 40);
    const loose = [a, b, c];
    expect(nextInDirection(a, loose, 'right')?.ref).toBe('b');
    expect(nextInDirection(a, loose, 'down')?.ref).toBe('c');
    expect(nextInDirection(a, loose, 'left')).toBeNull();
  });

  it('lets a sectionless origin move into a section', () => {
    // A control above the first row and in no section of its own; Down from it
    // has to reach the posters or the page has an unreachable top.
    const logo = box('logo', 0, -100, null, 120, 60);
    expect(nextInDirection(logo, home, 'down')?.ref).toBe('a1');
  });

  it('lands under its own centre, not at the start of the row it enters', () => {
    // A wide element spanning the whole row: every poster is below it, so
    // "below" alone does not decide it and the cross-axis weight does. The one
    // under the thumb is the one the eye is already on.
    const header = box('header', 0, -100, null, 600, 60);
    expect(nextInDirection(header, home, 'down')?.ref).toBe('a2');
  });

  it('steps down and up the lines of a grid that is one section', () => {
    // FEAT-661 Q-01 — the catalogue, the watchlist and the collections are
    // one `[data-nav-section]` laid out as a grid. Down from the first line
    // has to reach the second, not leave the grid for whatever is below it.
    const grid = [
      box('g1', 0, 0, 'grid'),
      box('g2', 200, 0, 'grid'),
      box('g3', 0, 300, 'grid'),
      box('g4', 200, 300, 'grid'),
    ];
    const footer = box('footer', 0, 700, null, 400, 40);
    const page = [...grid, footer];
    expect(nextInDirection(grid[1], page, 'down')?.ref).toBe('g4');
    expect(nextInDirection(grid[2], page, 'up')?.ref).toBe('g1');
    expect(nextInDirection(grid[3], page, 'down')?.ref).toBe('footer');
  });

  it('does not step down into a control inside the card it is leaving', () => {
    // A poster card's own buttons sit inside its box, in its row's section.
    // Down means the next row; the card's controls are not a line below it.
    const inner = box('inner', 100, 200, 'row-a', 50, 30);
    expect(nextInDirection(rowA[0], [...home, inner], 'down')?.ref).toBe('b1');
  });

  it('returns null when there is nothing at all in that direction', () => {
    expect(nextInDirection(rowA[0], [], 'right')).toBeNull();
  });
});
