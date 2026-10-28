import { useLayoutEffect, useState, useSyncExternalStore } from 'react';
import type { StateView } from '../shared/protocol';
import { sfx } from './sound';

export interface RevealSnap {
  stage: 0 | 1 | 2;
  shown: number;
  replayN: number;
  guessDone: number;
}

/**
 * Drives the staged vote reveal. When the fake artist is caught the reveal plays before their guess so nothing
 * gives them away early; the result screen then skips straight to the final stage.
 */
class RevealCtl {
  private snap: RevealSnap = { stage: 0, shown: 0, replayN: 0, guessDone: -1 };
  private revealGame = -1;
  private guessStarted = -1;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private listeners = new Set<() => void>();
  private S!: StateView;
  private local = false;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  getSnapshot = () => this.snap;

  private set(patch: Partial<RevealSnap>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, ms));
  }

  private stop() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  reset() {
    this.stop();
    this.revealGame = this.guessStarted = -1;
    this.snap = { stage: 0, shown: 0, replayN: 0, guessDone: -1 };
    this.listeners.forEach((fn) => fn());
  }

  replay = () => this.set({ replayN: this.snap.replayN + 1 });

  sync(S: StateView, local: boolean) {
    this.S = S;
    this.local = local;
    if (S.phase !== 'result' && S.phase !== 'guess') {
      if (this.revealGame !== -1 || this.guessStarted !== -1 || this.snap.guessDone !== -1 || this.snap.stage !== 0) this.reset();
      return;
    }
    if (S.phase === 'result' && this.revealGame !== S.gameNo) {
      this.revealGame = S.gameNo;
      this.stop();
      if (this.snap.guessDone === S.gameNo) return this.showFinal();
      this.playVotes(S.result!.votes, () => this.showFinal());
    }
    if (S.phase === 'guess' && this.guessStarted !== S.gameNo) {
      this.guessStarted = S.gameNo;
      const game = S.gameNo;
      this.playVotes(S.revealVotes!, () => this.set({ guessDone: game }));
    }
  }

  private playVotes(votes: Record<string, string>, onDone: () => void) {
    this.set({ stage: 0, shown: 0 });
    sfx.drum();
    const n = Object.keys(votes).length;
    for (let i = 0; i < n; i++) this.later(900 + i * 700, () => { this.set({ shown: i + 1 }); sfx.blip(); });
    const t1 = 900 + n * 700 + 900;
    this.later(t1, () => { this.set({ stage: 1 }); sfx.drum(); });
    this.later(t1 + 1800, onDone);
  }

  private showFinal() {
    const S = this.S;
    const youWin = S.phase !== 'lobby' && (S.isImposter ? S.result!.imposterWins : !S.result!.imposterWins);
    if (this.local || youWin) sfx.win();
    else sfx.lose();
    this.set({ stage: 2, replayN: this.snap.replayN + 1 });
  }
}

export type Reveal = ReturnType<typeof useReveal>;

export function useReveal(S: StateView, local: boolean) {
  const [ctl] = useState(() => new RevealCtl());
  const snap = useSyncExternalStore(ctl.subscribe, ctl.getSnapshot);
  useLayoutEffect(() => {
    ctl.sync(S, local);
  }, [ctl, S, local]);
  useLayoutEffect(() => () => ctl.reset(), [ctl]);
  return { ...snap, replay: ctl.replay, guessRevealing: S.phase === 'guess' && snap.guessDone !== S.gameNo };
}
