import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { startServer } from './app.js';
import type { ClientMsg, GameView, ServerMsg, Settings, StateView, StrokeRelay } from '../shared/protocol.js';

let srv: Awaited<ReturnType<typeof startServer>>;
beforeAll(async () => {
  srv = await startServer(0);
});
afterAll(() => srv.close());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Client {
  ws = new WebSocket(`ws://localhost:${srv.port}/ws`);
  S!: StateView;
  strokes: StrokeRelay[] = [];
  errors: string[] = [];
  ready = new Promise<void>((r) => this.ws.on('open', () => r()));

  constructor() {
    this.ws.on('message', (raw) => {
      const m: ServerMsg = JSON.parse(String(raw));
      if (m.t === 'state') this.S = m;
      else if (m.t === 'stroke') this.strokes.push(m);
      else this.errors.push(m.msg);
    });
  }
  send(m: ClientMsg) {
    this.ws.send(JSON.stringify(m));
  }
  get G() {
    return this.S as GameView;
  }
}

async function until(fn: () => boolean, what: string, ms = 1500) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(10);
  }
}

async function room(settings: Partial<Settings> = {}, start = true) {
  const cs = [new Client(), new Client(), new Client()];
  await Promise.all(cs.map((c) => c.ready));
  const [a, b, c] = cs as [Client, Client, Client];
  a.send({ t: 'create', name: 'ann' });
  await until(() => !!a.S, 'room created');
  b.send({ t: 'join', code: a.S.code.toLowerCase(), name: 'bob' });
  c.send({ t: 'join', code: a.S.code, name: 'cy' });
  await until(() => a.S.players.length === 3, 'players joined');
  a.send({ t: 'settings', ...settings });
  if (start) {
    a.send({ t: 'start' });
    await until(() => cs.every((x) => x.S.phase === 'drawing'), 'game start');
  } else await sleep(30);
  const turn = () => cs.find((x) => x.S.you === a.G.turnPlayer)!;
  const close = () => cs.forEach((x) => x.ws.close());
  return { cs, a, b, c, turn, close };
}

describe('http', () => {
  it('answers the health check', async () => {
    const res = await fetch(`http://localhost:${srv.port}/healthz`);
    expect(res.status).toBe(200);
  });
});

describe('lobby', () => {
  it('rejects duplicate names, unknown rooms, and clamps avatars', async () => {
    const { a, b, close } = await room({}, false);
    const dup = new Client();
    await dup.ready;
    dup.send({ t: 'join', code: a.S.code, name: 'BOB' });
    await until(() => dup.errors.length > 0, 'error');
    expect(dup.errors[0]).toBe('Name already taken');
    dup.send({ t: 'join', code: 'ZZZZ', name: 'x' });
    await until(() => dup.errors.length > 1, 'error');
    expect(dup.errors[1]).toBe('Room not found');

    const odd = new Client();
    await odd.ready;
    odd.send({ t: 'join', code: a.S.code, name: 'odd', avatar: ['<script>', 99, -1, 1.5] as never });
    await until(() => !!odd.S, 'joined');
    const av = odd.S.players.find((p) => p.name === 'odd')!.avatar;
    expect(av[0]).toMatch(/^#[0-9a-f]{6}$/i);
    expect(av.slice(1).every((n) => Number.isInteger(n) && n >= 0 && n < 6)).toBe(true);
    expect(b.S.players).toHaveLength(4);
    [dup, odd].forEach((x) => x.ws.close());
    close();
  });

  it('honours a requested pen color and rejects one already taken', async () => {
    const { a, b, close } = await room({}, false);
    const x = new Client();
    await x.ready;
    x.send({ t: 'join', code: a.S.code, name: 'dee', color: '#112233' });
    await until(() => !!x.S, 'joined');
    expect(b.S.players.find((p) => p.name === 'dee')!.color).toBe('#112233');
    const y = new Client();
    await y.ready;
    y.send({ t: 'join', code: a.S.code, name: 'eve', color: '#112233' });
    await until(() => y.errors.length > 0, 'error');
    expect(y.errors[0]).toBe('Pen color already taken');
    [x, y].forEach((c) => c.ws.close());
    close();
  });

  it('only the host can change settings', async () => {
    const { a, b, close } = await room({ rounds: 3 }, false);
    b.send({ t: 'settings', rounds: 1 });
    await sleep(50);
    expect(a.S.settings.rounds).toBe(3);
    close();
  });
});

describe('budget mode', () => {
  it('hides the word from the imposter and enforces turn order and ink', async () => {
    const { cs, a, turn, close } = await room({ mode: 'budget', budget: 150, rounds: 1 });
    const imp = cs.find((c) => c.G.isImposter)!;
    expect(cs.filter((c) => c.G.isImposter)).toHaveLength(1);
    expect(imp.G.word).toBeNull();
    const word = cs.find((c) => !c.G.isImposter)!.G.word!;
    expect(JSON.stringify(imp.S)).not.toContain(`"${word}"`);

    const first = turn();
    const other = cs.find((c) => c !== first)!;
    other.send({ t: 'stroke', sid: 'x1', pts: [[10, 10], [20, 20]], end: true });
    await sleep(50);
    expect(first.G.strokes).toHaveLength(0);

    first.send({ t: 'stroke', sid: 's1', pts: [[0, 0], [100, 0]], end: false });
    first.send({ t: 'stroke', sid: 's1', pts: [[100, 0], [200, 0]], end: false });
    await until(() => a.G.strokes.length === 1 && a.G.turnPlayer !== first.S.you, 'turn advance');
    const mine = a.G.strokes[0]!;
    expect(mine.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(mine.pts.at(-1)![0]).toBe(150);
    expect(cs.filter((c) => c !== first).every((c) => c.strokes.length >= 2)).toBe(true);
    close();
  });

  it('plays through to a result when everyone votes the imposter and the guess is right', async () => {
    const { cs, a, turn, close } = await room({ mode: 'budget', budget: 150, rounds: 1 });
    for (let i = 0; i < 3; i++) {
      const t = turn();
      const before = a.G.turnNo;
      t.send({ t: 'endTurn' });
      await until(() => a.G.turnNo !== before || a.G.phase === 'voting', 'next turn');
    }
    expect(a.G.phase).toBe('voting');
    const imp = cs.find((c) => c.G.isImposter)!;
    const others = cs.filter((c) => c !== imp);
    others.forEach((c) => c.send({ t: 'vote', target: imp.S.you }));
    imp.send({ t: 'vote', target: others[0]!.S.you });
    await until(() => a.S.phase === 'guess', 'guess phase');
    imp.send({ t: 'guess', guess: ` ${imp.G.category} ` });
    await until(() => a.S.phase === 'result', 'result');
    expect(a.G.result!.imposterWins).toBe(false);
    a.send({ t: 'again' });
    await until(() => a.S.phase === 'lobby', 'lobby');
    close();
  });
});

describe('free modes', () => {
  it('single mode allows exactly one stroke per turn and a done vote after each round', async () => {
    const { cs, a, turn, close } = await room({ mode: 'single', rounds: 0, timer: 0 });
    for (let i = 0; i < 3; i++) {
      const t = turn();
      t.send({ t: 'stroke', sid: `a${i}`, pts: [[0, 0], [700, 500]], end: true });
      t.send({ t: 'stroke', sid: `b${i}`, pts: [[0, 0], [10, 10]], end: true });
      await until(() => a.G.strokes.length === i + 1, 'stroke');
    }
    await until(() => a.S.phase === 'doneVote', 'done vote');
    expect(a.G.strokes).toHaveLength(3);

    cs[0]!.send({ t: 'doneVote', yes: false });
    cs[1]!.send({ t: 'doneVote', yes: false });
    cs[2]!.send({ t: 'doneVote', yes: true });
    await until(() => a.S.phase === 'drawing' && a.G.round === 2, 'second round');

    for (let i = 0; i < 3; i++) {
      turn().send({ t: 'stroke', sid: `c${i}`, pts: [[1, 1], [9, 9]], end: true });
      await until(() => a.G.strokes.length === 4 + i, 'stroke');
    }
    await until(() => a.S.phase === 'doneVote', 'done vote 2');
    cs[0]!.send({ t: 'doneVote', yes: true });
    cs[1]!.send({ t: 'doneVote', yes: true });
    cs[2]!.send({ t: 'doneVote', yes: false });
    await until(() => a.S.phase === 'voting', 'voting');
    close();
  });

  it('a tie lets the imposter escape', async () => {
    const { cs, a, close } = await room({ mode: 'single', rounds: 1, timer: 0 });
    const turn = () => cs.find((x) => x.S.you === a.G.turnPlayer)!;
    for (let i = 0; i < 3; i++) {
      turn().send({ t: 'stroke', sid: `t${i}`, pts: [[1, 1], [9, 9]], end: true });
      await until(() => a.G.strokes.length === i + 1, 'stroke');
    }
    await until(() => a.S.phase === 'voting', 'voting');
    const imp = cs.find((x) => x.G.isImposter)!;
    const [o1, o2] = cs.filter((x) => x !== imp) as [Client, Client];
    o1.send({ t: 'vote', target: imp.S.you });
    o2.send({ t: 'vote', target: o1.S.you });
    imp.send({ t: 'vote', target: o2.S.you });
    await until(() => a.S.phase === 'result', 'result');
    expect(a.G.result).toMatchObject({ imposterWins: true, caught: false });
    expect(a.G.word).not.toBeNull();
    close();
  });

  it('free mode lets a player draw several strokes and end their own turn', async () => {
    const { a, turn, close } = await room({ mode: 'free', rounds: 0, timer: 0 });
    const first = turn();
    for (let i = 0; i < 3; i++) first.send({ t: 'stroke', sid: `s${i}`, pts: [[0, 0], [700, 500]], end: true });
    await until(() => a.G.strokes.length === 3, 'strokes');
    expect(a.G.turnPlayer).toBe(first.S.you);
    first.send({ t: 'endTurn' });
    await until(() => a.G.turnPlayer !== first.S.you, 'turn change');
    close();
  });
});

describe('finish drawing', () => {
  it('ignores the vote when rounds are fixed', async () => {
    const { a, close } = await room({ mode: 'free', rounds: 2, timer: 0 });
    a.send({ t: 'finishDrawing' });
    await sleep(50);
    expect(a.G.finishVotes).toBe(0);
    close();
  });

  it('toggles votes and a majority ends drawing, including off-turn voters', async () => {
    const { cs, a, b, c, close } = await room({ mode: 'free', rounds: 0, timer: 0 });
    a.send({ t: 'finishDrawing' });
    await until(() => b.G.finishVotes === 1 && a.G.youFinishVoted, 'vote counted');
    a.send({ t: 'finishDrawing' });
    await until(() => b.G.finishVotes === 0, 'vote toggled off');
    a.send({ t: 'finishDrawing' });
    b.send({ t: 'finishDrawing' });
    await until(() => c.S.phase === 'voting', 'majority');
    expect(cs.every((x) => x.S.phase === 'voting')).toBe(true);
    close();
  });
});

describe('disconnects and timers', () => {
  it('resets to the lobby when a player leaves mid-game', async () => {
    const { a, c, close } = await room({ mode: 'single', timer: 0 });
    c.ws.close();
    await until(() => a.S.phase === 'lobby', 'reset');
    expect(a.S.notice).toMatch(/left/);
    close();
  });

  it('auto-advances the turn when the timer expires', async () => {
    const { a, close } = await room({ mode: 'single', timer: 15 });
    expect(a.S.msLeft).toBeGreaterThan(13000);
    const first = a.G.turnPlayer;
    await until(() => a.G.turnPlayer !== first, 'timer expiry', 16500);
    expect(a.G.strokes).toHaveLength(0);
    expect(a.G.turnNo).toBe(2);
    close();
  }, 20000);
});
