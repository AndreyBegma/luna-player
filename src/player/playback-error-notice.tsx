'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@andrewbehma/glass-ui/button';
import { Card } from '@andrewbehma/glass-ui/card';
import { useLabels } from '../labels';

interface Props {
  onRetry: () => void;
}

/**
 * BUG-20260820-213 — shown when hls.js has given up on a stream.
 *
 * Until now a fatal error left the last frame on screen and nothing else, which
 * is indistinguishable from a very long buffer. Saying so, and offering the
 * retry that used to require a page reload, is the whole point of this.
 */
export function PlaybackErrorNotice({ onRetry }: Props) {
  const labels = useLabels();
  const retryRef = useRef<HTMLButtonElement>(null);

  /**
   * FEAT-20260923-661 Q-08 — on a television the remote lands on Retry, the
   * way the end screen puts it on its primary action, and the focus goes back
   * where it was once the notice is gone.
   */
  useEffect(() => {
    const before =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    retryRef.current?.focus();
    return () => {
      if (before?.isConnected) before.focus();
    };
  }, []);

  return (
    <div className="absolute inset-0 z-raised flex items-center justify-center px-4">
      <Card
        variant="glass"
        pad="none"
        className="player-notice rounded-surface px-6 py-5 flex flex-col items-center gap-3 text-center max-w-sm"
      >
        {/* Q-08 — said out loud: the frozen frame alone tells a screen
            reader nothing. */}
        <div role="alert" className="flex flex-col items-center gap-3">
          <span className="text-ink text-base font-semibold">
            {labels.playbackFailed}
          </span>
          <span className="text-ink-2 text-sm">{labels.playbackFailedHint}</span>
        </div>
        {/* Q-07 — the design system's white primary. */}
        <Button ref={retryRef} variant="solid" onClick={onRetry}>
          {labels.retryPlayback}
        </Button>
      </Card>
    </div>
  );
}
