/**
 * FEAT-20260925-718 L3 — the player renders on a server, as Next.js's App
 * Router renders every client component once before hydration: nothing in
 * render reaches for `window`, `localStorage`, `matchMedia` or the media
 * element, and the first paint already holds the `<video>`.
 */
import { describe, expect, test } from 'bun:test';
import { renderToString } from 'react-dom/server';
import { Player } from './player';

describe('<Player> on a server', () => {
  test('renderToString does not throw, and the output holds the <video>', () => {
    const html = renderToString(<Player src="/a.mp4" />);
    expect(html).toContain('<video');
    expect(html).toContain('aspect-ratio:16/9');
  });

  test('the props a host passes render too', () => {
    const html = renderToString(
      <Player
        src="/a.mp4"
        poster="/a.jpg"
        aspectRatio="9:16"
        title="Solaris"
        storage={null}
        labels={{ ariaPlay: 'X' }}
      />,
    );
    expect(html).toContain('poster="/a.jpg"');
    expect(html).toContain('aspect-ratio:9/16');
    expect(html).toContain('aria-label="Solaris"');
  });
});
