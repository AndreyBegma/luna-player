/**
 * FEAT-20260923-654 — the order the graph is built in is the whole of its
 * safety, so it is what these check: nothing routed unless the context runs,
 * the element in CORS mode before it is routed, and "off" as the untouched
 * path — for night mode and for dialogue boost alike. A fake context stands in for Web Audio, which bun does not have.
 */
import { describe, expect, test } from 'bun:test';
import { attachSoundGraph } from './audio-graph';

type Log = string[];

class FakeParam {
  value = 0;
  setTargetAtTime(target: number) {
    this.value = target;
  }
}

class FakeNode {
  constructor(
    readonly name: string,
    private readonly log: Log,
  ) {}
  gain = new FakeParam();
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  type = '';
  connect(to: { name: string }) {
    this.log.push(`${this.name}->${to.name}`);
  }
}

function fakeContext(
  startsAs: AudioContextState,
  resumesTo: AudioContextState,
) {
  const log: Log = [];
  const listeners = new Set<() => void>();
  const gains: FakeNode[] = [];
  const filters: FakeNode[] = [];
  let instance: { state: AudioContextState } | null = null;
  class Context {
    state: AudioContextState = startsAs;
    currentTime = 0;
    destination = { name: 'out' };
    constructor() {
      instance = this;
      log.push('new');
    }
    resume() {
      log.push('resume');
      this.state = resumesTo;
      return Promise.resolve();
    }
    close() {
      log.push('close');
      this.state = 'closed';
      return Promise.resolve();
    }
    createMediaElementSource(video: { crossOrigin: string | null }) {
      log.push(`source(crossOrigin=${video.crossOrigin})`);
      return new FakeNode('source', log);
    }
    createGain() {
      const node = new FakeNode(`gain${gains.length}`, log);
      gains.push(node);
      return node;
    }
    createDynamicsCompressor() {
      return new FakeNode('compressor', log);
    }
    createBiquadFilter() {
      const node = new FakeNode(`filter${filters.length}`, log);
      filters.push(node);
      return node;
    }
    addEventListener(_: string, listener: () => void) {
      listeners.add(listener);
    }
    removeEventListener(_: string, listener: () => void) {
      listeners.delete(listener);
    }
  }
  return {
    Context: Context as unknown as typeof AudioContext,
    log,
    gains,
    filters,
    listeners,
    instance: () => {
      if (!instance) throw new Error('no context was made');
      return instance;
    },
  };
}

function fakeVideo() {
  const listeners = new Set<() => void>();
  return {
    crossOrigin: null as string | null,
    paused: false,
    addEventListener: (_: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) =>
      listeners.delete(listener),
    listeners,
  };
}

const asVideo = (v: ReturnType<typeof fakeVideo>) =>
  v as unknown as HTMLVideoElement;

describe('attachSoundGraph', () => {
  test('routes nothing when the context will not start', async () => {
    const fake = fakeContext('suspended', 'suspended');
    const video = fakeVideo();
    expect(await attachSoundGraph(asVideo(video), fake.Context)).toBeNull();
    expect(fake.log).toEqual(['new', 'resume', 'close']);
    expect(video.crossOrigin).toBeNull();
  });

  test('resumes, then puts the element in CORS mode, then routes it', async () => {
    const fake = fakeContext('suspended', 'running');
    const video = fakeVideo();
    const graph = await attachSoundGraph(asVideo(video), fake.Context);
    expect(graph).not.toBeNull();
    expect(fake.log.slice(0, 3)).toEqual([
      'new',
      'resume',
      'source(crossOrigin=anonymous)',
    ]);
  });

  test('builds the dialogue filter, then a dry path and a night path, and starts untouched', async () => {
    const fake = fakeContext('running', 'running');
    await attachSoundGraph(asVideo(fakeVideo()), fake.Context);
    const [dry, trim, night] = fake.gains;
    const [shelf, presence] = fake.filters;
    expect([shelf.type, shelf.frequency.value]).toEqual(['lowshelf', 150]);
    expect([presence.type, presence.frequency.value]).toEqual([
      'peaking',
      2500,
    ]);
    expect(presence.Q.value).toBeCloseTo(0.9, 5);
    expect(fake.log).toContain(`source->${shelf.name}`);
    expect(fake.log).toContain(`${shelf.name}->${presence.name}`);
    expect(fake.log).toContain(`${presence.name}->${dry.name}`);
    expect(fake.log).toContain(`${dry.name}->out`);
    expect(fake.log).toContain(`${presence.name}->compressor`);
    expect(fake.log).toContain(`compressor->${trim.name}`);
    expect(fake.log).toContain(`${trim.name}->${night.name}`);
    expect(fake.log).toContain(`${night.name}->out`);
    expect(night.gain.value).toBe(0);
    expect(trim.gain.value).toBeCloseTo(0.501, 3);
    // 0 dB filters are an identity: nothing heard differs until a press.
    expect([shelf.gain.value, presence.gain.value]).toEqual([0, 0]);
  });

  test('night on and off crossfade the two paths', async () => {
    const fake = fakeContext('running', 'running');
    const graph = await attachSoundGraph(asVideo(fakeVideo()), fake.Context);
    const [dry, , night] = fake.gains;
    graph?.set({ night: true, dialogue: false });
    expect([dry.gain.value, night.gain.value]).toEqual([0, 1]);
    graph?.set({ night: false, dialogue: false });
    expect([dry.gain.value, night.gain.value]).toEqual([1, 0]);
  });

  test('dialogue boost alone lifts the speech band and trims the dry path by the lift', async () => {
    const fake = fakeContext('running', 'running');
    const graph = await attachSoundGraph(asVideo(fakeVideo()), fake.Context);
    const [dry, , night] = fake.gains;
    const [shelf, presence] = fake.filters;
    graph?.set({ night: false, dialogue: true });
    expect([shelf.gain.value, presence.gain.value]).toEqual([-3, 5]);
    // −5 dB: the filter's largest gain, so nothing it lifts can clip.
    expect(dry.gain.value).toBeCloseTo(0.562, 3);
    expect(night.gain.value).toBe(0);
  });

  test('with night mode on, dialogue boost feeds the compressor untrimmed', async () => {
    const fake = fakeContext('running', 'running');
    const graph = await attachSoundGraph(asVideo(fakeVideo()), fake.Context);
    const [dry, trim, night] = fake.gains;
    const [shelf, presence] = fake.filters;
    graph?.set({ night: true, dialogue: true });
    expect([shelf.gain.value, presence.gain.value]).toEqual([-3, 5]);
    expect([dry.gain.value, night.gain.value]).toEqual([0, 1]);
    expect(trim.gain.value).toBeCloseTo(0.501, 3);
  });

  test('both off returns every filter and path to the untouched mix', async () => {
    const fake = fakeContext('running', 'running');
    const graph = await attachSoundGraph(asVideo(fakeVideo()), fake.Context);
    const [dry, , night] = fake.gains;
    const [shelf, presence] = fake.filters;
    graph?.set({ night: true, dialogue: true });
    graph?.set({ night: false, dialogue: false });
    expect([
      shelf.gain.value,
      presence.gain.value,
      dry.gain.value,
      night.gain.value,
    ]).toEqual([0, 0, 1, 0]);
  });

  // FEAT-20260923-661 (Q-04) — a rejection here left the hook's build flag
  // set for the element's life, and both sound rows dead.
  test('answers null when no context can be made', async () => {
    const Refusing = class {
      constructor() {
        throw new DOMException('too many contexts', 'NotSupportedError');
      }
    } as unknown as typeof AudioContext;
    const video = fakeVideo();
    expect(await attachSoundGraph(asVideo(video), Refusing)).toBeNull();
    expect(video.crossOrigin).toBeNull();
  });

  test('a second routing of the same element is refused, not thrown', async () => {
    const fake = fakeContext('running', 'running');
    const Throwing = class extends (fake.Context as unknown as new () => {
      createMediaElementSource(): never;
    }) {
      createMediaElementSource(): never {
        throw new DOMException('already connected', 'InvalidStateError');
      }
    } as unknown as typeof AudioContext;
    expect(await attachSoundGraph(asVideo(fakeVideo()), Throwing)).toBeNull();
    expect(fake.log.at(-1)).toBe('close');
  });

  test('a context suspended under a playing film is resumed; a paused one is left', async () => {
    const fake = fakeContext('running', 'running');
    const video = fakeVideo();
    await attachSoundGraph(asVideo(video), fake.Context);
    const context = fake.instance();
    context.state = 'suspended';
    fake.log.length = 0;

    video.paused = true;
    for (const listener of fake.listeners) listener();
    expect(fake.log).toEqual([]);

    video.paused = false;
    for (const listener of video.listeners) listener();
    expect(fake.log).toEqual(['resume']);
  });

  test('close lets go of the element and the context', async () => {
    const fake = fakeContext('running', 'running');
    const video = fakeVideo();
    const graph = await attachSoundGraph(asVideo(video), fake.Context);
    graph?.close();
    expect(video.listeners.size).toBe(0);
    expect(fake.listeners.size).toBe(0);
    expect(fake.log.at(-1)).toBe('close');
  });
});
