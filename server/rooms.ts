import crypto from 'node:crypto';
import type { WebSocket } from 'ws';
import WORDS from './words.js';
import {
  AVATAR_PARTS,
  H,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PEN_COLORS,
  SKINS,
  TIMER_CHOICES,
  W,
  clamp,
  round1,
  type Avatar,
  type ClientMsg,
  type EnterMsg,
  type GameResult,
  type GameView,
  type Phase,
  type ServerMsg,
  type Settings,
  type StateView,
  type StrokeData,
  type StrokeRelay,
} from '../shared/protocol.js';

const DONE_SECS = 20;
const VOTE_SECS = 30;
const GUESS_SECS = 30;

interface Player {
  id: string;
  name: string;
  avatar: Avatar;
  color: string;
  ws: Sock;
}

interface LiveStroke extends StrokeData {
  ended: boolean;
}

interface Room {
  code: string;
  hostId: string;
  players: Player[];
  settings: Settings;
  gameNo: number;
  phase: Phase;
  notice: string | null;
  timer: NodeJS.Timeout | null;
  deadline: number | null;
  category: string;
  word: string;
  imposterId: string;
  order: string[];
  turnIdx: number;
  round: number;
  turnNo: number;
  strokes: LiveStroke[];
  doneVotes: Record<string, boolean>;
  finishVotes: Set<string>;
  votes: Record<string, string>;
  result: GameResult | null;
  inkLeft: number | null;
  strokesThisTurn: number;
  cur: LiveStroke | null;
}

type Sock = WebSocket & { room?: Room; player?: Player };

const rooms = new Map<string, Room>();

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function makeCode() {
  let code: string;
  do {
    code = Array.from({ length: 4 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');
  } while (rooms.has(code));
  return code;
}

function send(ws: Sock, obj: ServerMsg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function viewFor(room: Room, p: Player): StateView {
  const base = {
    t: 'state' as const,
    code: room.code,
    you: p.id,
    hostId: room.hostId,
    players: room.players.map(({ id, name, color, avatar }) => ({ id, name, color, avatar })),
    settings: room.settings,
    notice: room.notice,
    gameNo: room.gameNo,
    msLeft: room.deadline ? Math.max(0, room.deadline - Date.now()) : null,
  };
  if (room.phase === 'lobby') return { ...base, phase: 'lobby' };

  const isImposter = p.id === room.imposterId;
  const view: GameView = {
    ...base,
    phase: room.phase,
    category: room.category,
    isImposter,
    word: isImposter && room.phase !== 'result' ? null : room.word,
    imposterId: room.phase === 'guess' ? room.imposterId : null,
    revealVotes: room.phase === 'guess' ? { ...room.votes } : null,
    order: room.order,
    turnPlayer: room.phase === 'drawing' ? room.order[room.turnIdx]! : null,
    turnNo: room.turnNo,
    round: room.round,
    inkLeft: room.inkLeft,
    strokes: room.strokes.map(({ sid, pid, color, w, pts }) => ({ sid, pid, color, w, pts })),
    finishVotes: room.finishVotes.size,
    youFinishVoted: room.finishVotes.has(p.id),
    doneVotes: Object.keys(room.doneVotes).length,
    youDoneVoted: p.id in room.doneVotes,
    voteCount: Object.keys(room.votes).length,
    youVoted: p.id in room.votes,
    result: room.result,
  };
  return view;
}

function broadcast(room: Room) {
  for (const p of room.players) send(p.ws, viewFor(room, p));
}

function clearTimer(room: Room) {
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;
  room.deadline = null;
}

function schedule(room: Room, secs: number, onExpire: () => void) {
  clearTimer(room);
  if (!room.settings.timer) return;
  room.deadline = Date.now() + secs * 1000;
  room.timer = setTimeout(() => {
    room.timer = null;
    room.deadline = null;
    onExpire();
    broadcast(room);
  }, secs * 1000);
}

function resetToLobby(room: Room) {
  clearTimer(room);
  room.phase = 'lobby';
  room.notice = null;
}

function startGame(room: Room) {
  room.gameNo++;
  room.category = pick(Object.keys(WORDS));
  room.word = pick(WORDS[room.category]!);
  room.imposterId = pick(room.players).id;
  room.order = shuffle(room.players.map((p) => p.id));
  room.turnIdx = 0;
  room.round = 1;
  room.turnNo = 0;
  room.strokes = [];
  room.doneVotes = {};
  room.finishVotes = new Set();
  room.votes = {};
  room.result = null;
  room.notice = null;
  room.phase = 'drawing';
  beginTurn(room);
}

function beginTurn(room: Room) {
  room.turnNo++;
  room.inkLeft = room.settings.mode === 'budget' ? room.settings.budget : null;
  room.strokesThisTurn = 0;
  room.cur = null;
  schedule(room, room.settings.timer, () => endTurn(room));
}

function toVoting(room: Room) {
  room.phase = 'voting';
  room.votes = {};
  schedule(room, VOTE_SECS, () => resolveVotes(room));
}

function endTurn(room: Room) {
  room.cur = null;
  room.turnIdx++;
  if (room.turnIdx >= room.order.length) {
    room.turnIdx = 0;
    if (room.settings.rounds > 0) {
      if (room.round >= room.settings.rounds) return toVoting(room);
      room.round++;
      room.finishVotes = new Set();
    } else {
      room.phase = 'doneVote';
      room.doneVotes = {};
      schedule(room, DONE_SECS, () => resolveDoneVote(room));
      return;
    }
  }
  beginTurn(room);
}

// Client and server run this same arithmetic on the same rounded points so they agree on exactly when ink runs out.
function onStroke(room: Room, p: Player, m: Extract<ClientMsg, { t: 'stroke' }>) {
  if (room.phase !== 'drawing' || room.order[room.turnIdx] !== p.id) return;
  if (typeof m.sid !== 'string' || m.sid.length > 16 || !Array.isArray(m.pts) || m.pts.length > 200) return;

  let cur = room.cur;
  if (cur && cur.sid === m.sid && cur.ended) return;
  if (!cur || cur.sid !== m.sid) {
    if (room.settings.mode === 'single' && room.strokesThisTurn >= 1) return;
    cur = room.cur = { sid: m.sid, pid: p.id, color: p.color, w: clamp(Math.round(Number(m.w)) || 10, 2, 40), pts: [], ended: false };
    room.strokes.push(cur);
    room.strokesThisTurn++;
  }

  const accepted: StrokeData['pts'] = [];
  let spent = false;
  for (const pt of m.pts) {
    if (!Array.isArray(pt)) continue;
    let x = clamp(round1(Number(pt[0])), 0, W);
    let y = clamp(round1(Number(pt[1])), 0, H);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const last = cur.pts[cur.pts.length - 1];
    if (last && room.inkLeft !== null) {
      const d = Math.hypot(x - last[0], y - last[1]);
      if (d >= room.inkLeft) {
        const f = room.inkLeft / d;
        x = round1(last[0] + (x - last[0]) * f);
        y = round1(last[1] + (y - last[1]) * f);
        room.inkLeft = 0;
      } else {
        room.inkLeft -= d;
        if (room.inkLeft < 0.5) room.inkLeft = 0;
      }
      spent = room.inkLeft === 0;
    }
    cur.pts.push([x, y]);
    accepted.push([x, y]);
    if (spent) break;
  }

  const ended = Boolean(m.end) || spent;
  broadcastStroke(room, p, { t: 'stroke', sid: cur.sid, pid: p.id, color: p.color, w: cur.w, pts: accepted, end: ended });
  if (!ended) return;

  cur.ended = true;
  if (room.settings.mode === 'single' || room.inkLeft === 0) endTurn(room);
  broadcast(room);
}

function broadcastStroke(room: Room, from: Player, msg: StrokeRelay) {
  for (const q of room.players) if (q !== from) send(q.ws, msg);
}

function resolveDoneVote(room: Room) {
  const yes = Object.values(room.doneVotes).filter(Boolean).length;
  if (yes > room.players.length / 2) return toVoting(room);
  room.round++;
  room.finishVotes = new Set();
  room.phase = 'drawing';
  beginTurn(room);
}

function finish(room: Room, caught: boolean, imposterWins: boolean, guess: string | null) {
  clearTimer(room);
  room.phase = 'result';
  room.result = {
    caught,
    imposterWins,
    guess,
    word: room.word,
    imposterId: room.imposterId,
    votes: { ...room.votes },
  };
}

function resolveVotes(room: Room) {
  const tally: Record<string, number> = {};
  for (const target of Object.values(room.votes)) tally[target] = (tally[target] || 0) + 1;
  const max = Math.max(...Object.values(tally));
  const top = Object.keys(tally).filter((id) => tally[id] === max);
  if (top.length === 1 && top[0] === room.imposterId) {
    room.phase = 'guess';
    schedule(room, GUESS_SECS, () => finish(room, true, false, ''));
  } else finish(room, false, true, null);
}

const cleanAvatar = (a: Avatar | undefined): Avatar => [
  /^#[0-9a-f]{6}$/i.test(a?.[0] as string) ? a![0] : pick(SKINS),
  ...(AVATAR_PARTS.map((n, i) => {
    const v = a?.[i + 1] as number;
    return Number.isInteger(v) && v >= 0 && v < n ? v : Math.floor(Math.random() * n);
  }) as [number, number, number]),
];

function enter(ws: Sock, m: EnterMsg) {
  if (ws.room) return;
  const name = String(m.name ?? '').trim().slice(0, 16);
  if (!name) return send(ws, { t: 'error', msg: 'Enter a name' });

  let room: Room;
  if (m.t === 'create') {
    room = {
      code: makeCode(),
      hostId: '',
      players: [],
      settings: { mode: 'budget', budget: 800, rounds: 2, colors: true, timer: 30 },
      gameNo: 0,
      phase: 'lobby',
      notice: null,
      timer: null,
      deadline: null,
      category: '',
      word: '',
      imposterId: '',
      order: [],
      turnIdx: 0,
      round: 1,
      turnNo: 0,
      strokes: [],
      doneVotes: {},
      finishVotes: new Set(),
      votes: {},
      result: null,
      inkLeft: null,
      strokesThisTurn: 0,
      cur: null,
    };
    rooms.set(room.code, room);
  } else {
    const found = rooms.get(String(m.code ?? '').trim().toUpperCase());
    if (!found) return send(ws, { t: 'error', msg: 'Room not found' });
    room = found;
    if (room.phase !== 'lobby') return send(ws, { t: 'error', msg: 'Game already started' });
    if (room.players.length >= MAX_PLAYERS) return send(ws, { t: 'error', msg: 'Room is full' });
    if (room.players.some((q) => q.name.toLowerCase() === name.toLowerCase())) {
      return send(ws, { t: 'error', msg: 'Name already taken' });
    }
  }

  let color = PEN_COLORS.find((c) => !room.players.some((q) => q.color === c))!;
  if (/^#[0-9a-f]{6}$/i.test(m.color as string)) {
    const want = m.color!.toLowerCase();
    if (room.players.some((q) => q.color === want)) return send(ws, { t: 'error', msg: 'Pen color already taken' });
    color = want;
  }

  const p: Player = {
    id: crypto.randomUUID().slice(0, 8),
    name,
    avatar: cleanAvatar(m.avatar),
    color,
    ws,
  };
  room.players.push(p);
  if (m.t === 'create') room.hostId = p.id;
  ws.room = room;
  ws.player = p;
  broadcast(room);
}

function leave(ws: Sock) {
  const room = ws.room;
  const p = ws.player;
  if (!room || !p) return;
  room.players = room.players.filter((q) => q !== p);
  if (!room.players.length) {
    clearTimer(room);
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === p.id) room.hostId = room.players[0]!.id;
  if (room.phase !== 'lobby') {
    resetToLobby(room);
    room.notice = `${p.name} left, so the game was reset.`;
  }
  broadcast(room);
}

function handle(ws: Sock, m: ClientMsg) {
  if (m.t === 'create' || m.t === 'join') return enter(ws, m);
  const room = ws.room;
  const p = ws.player;
  if (!room || !p) return;
  const isHost = room.hostId === p.id;

  switch (m.t) {
    case 'settings': {
      if (!isHost || room.phase !== 'lobby') return;
      const s = room.settings;
      if (m.mode && ['budget', 'free', 'single'].includes(m.mode)) s.mode = m.mode;
      if (typeof m.colors === 'boolean') s.colors = m.colors;
      if (m.timer !== undefined && TIMER_CHOICES.includes(m.timer)) s.timer = m.timer;
      if (Number.isFinite(m.budget)) s.budget = clamp(Math.round(m.budget!), 50, 2000);
      if (Number.isFinite(m.rounds)) s.rounds = clamp(Math.round(m.rounds!), 0, 5);
      return broadcast(room);
    }
    case 'color': {
      const want = String(m.color).toLowerCase();
      if (room.phase !== 'lobby' || !/^#[0-9a-f]{6}$/.test(want)) return;
      if (room.players.some((q) => q !== p && q.color === want)) return send(ws, { t: 'error', msg: 'Pen color already taken' });
      p.color = want;
      return broadcast(room);
    }
    case 'start':
      if (!isHost || room.phase !== 'lobby' || room.players.length < MIN_PLAYERS) return;
      startGame(room);
      return broadcast(room);
    case 'stroke':
      return onStroke(room, p, m);
    case 'endTurn':
      if (room.phase !== 'drawing' || room.order[room.turnIdx] !== p.id || room.settings.mode === 'single') return;
      endTurn(room);
      return broadcast(room);
    case 'finishDrawing':
      if (room.phase !== 'drawing' || room.settings.rounds > 0) return;
      if (!room.finishVotes.delete(p.id)) room.finishVotes.add(p.id);
      if (room.finishVotes.size > room.players.length / 2) {
        room.cur = null;
        toVoting(room);
      }
      return broadcast(room);
    case 'doneVote':
      if (room.phase !== 'doneVote' || p.id in room.doneVotes) return;
      room.doneVotes[p.id] = Boolean(m.yes);
      if (Object.keys(room.doneVotes).length === room.players.length) resolveDoneVote(room);
      return broadcast(room);
    case 'vote':
      if (room.phase !== 'voting' || p.id in room.votes) return;
      if (m.target === p.id || !room.players.some((q) => q.id === m.target)) return;
      room.votes[p.id] = m.target;
      if (Object.keys(room.votes).length === room.players.length) resolveVotes(room);
      return broadcast(room);
    case 'guess':
      if (room.phase !== 'guess' || p.id !== room.imposterId) return;
      finish(room, true, norm(m.guess) === norm(room.word), String(m.guess ?? '').trim().slice(0, 40));
      return broadcast(room);
    case 'again':
      if (!isHost || room.phase !== 'result') return;
      resetToLobby(room);
      return broadcast(room);
  }
}

export function onConnection(ws: WebSocket) {
  const sock = ws as Sock;
  sock.on('message', (raw) => {
    let m: ClientMsg;
    try {
      m = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (m && typeof m.t === 'string') handle(sock, m);
  });
  sock.on('close', () => leave(sock));
}
