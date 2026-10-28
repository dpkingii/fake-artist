import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import WORDS from './words.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const W = 800;
const H = 600;
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 8;
const TIMER_CHOICES = [0, 15, 30, 60];
const DONE_SECS = 20;
const VOTE_SECS = 30;
const GUESS_SECS = 30;
const COLORS = ['#d8607a', '#5fae6e', '#6a82cc', '#e09a5c', '#9a69b3', '#4f9a9a', '#a08060', '#cf7fc0'];

const rooms = new Map();

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  if (pathname !== '/' && pathname !== '/index.html') {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  fs.createReadStream(path.join(dir, 'public', 'index.html')).pipe(res);
});

const wss = new WebSocketServer({ server });

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round1 = (n) => Math.round(n * 10) / 10;
const norm = (s) => String(s ?? '').trim().toLowerCase();

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');
  } while (rooms.has(code));
  return code;
}

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function viewFor(room, p) {
  const v = {
    t: 'state',
    code: room.code,
    you: p.id,
    hostId: room.hostId,
    players: room.players.map(({ id, name, color, avatar }) => ({ id, name, color, avatar })),
    settings: room.settings,
    phase: room.phase,
    notice: room.notice,
    gameNo: room.gameNo,
    msLeft: room.deadline ? Math.max(0, room.deadline - Date.now()) : null,
  };
  if (room.phase === 'lobby') return v;

  const isImposter = p.id === room.imposterId;
  v.category = room.category;
  v.isImposter = isImposter;
  v.word = isImposter && room.phase !== 'result' ? null : room.word;
  v.imposterId = room.phase === 'guess' ? room.imposterId : null;
  v.revealVotes = room.phase === 'guess' ? { ...room.votes } : null;
  v.order = room.order;
  v.turnPlayer = room.phase === 'drawing' ? room.order[room.turnIdx] : null;
  v.turnNo = room.turnNo;
  v.round = room.round;
  v.inkLeft = room.inkLeft;
  v.strokes = room.strokes.map(({ sid, pid, color, w, pts }) => ({ sid, pid, color, w, pts }));
  v.finishVotes = room.finishVotes.size;
  v.youFinishVoted = room.finishVotes.has(p.id);
  v.doneVotes = Object.keys(room.doneVotes).length;
  v.youDoneVoted = p.id in room.doneVotes;
  v.voteCount = Object.keys(room.votes).length;
  v.youVoted = p.id in room.votes;
  v.result = room.result;
  return v;
}

function broadcast(room, except = null) {
  for (const p of room.players) if (p !== except) send(p.ws, viewFor(room, p));
}

function clearTimer(room) {
  clearTimeout(room.timer);
  room.timer = null;
  room.deadline = null;
}

function schedule(room, secs, onExpire) {
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

function resetToLobby(room) {
  clearTimer(room);
  room.phase = 'lobby';
  room.notice = null;
}

function startGame(room) {
  room.gameNo++;
  room.category = pick(Object.keys(WORDS));
  room.word = pick(WORDS[room.category]);
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

function beginTurn(room) {
  room.turnNo++;
  room.inkLeft = room.settings.mode === 'budget' ? room.settings.budget : null;
  room.strokesThisTurn = 0;
  room.cur = null;
  schedule(room, room.settings.timer, () => endTurn(room));
}

function toVoting(room) {
  room.phase = 'voting';
  room.votes = {};
  schedule(room, VOTE_SECS, () => resolveVotes(room));
}

function endTurn(room) {
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
function onStroke(room, p, m) {
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

  const accepted = [];
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

function broadcastStroke(room, from, msg) {
  for (const q of room.players) if (q !== from) send(q.ws, msg);
}

function resolveDoneVote(room) {
  const yes = Object.values(room.doneVotes).filter(Boolean).length;
  if (yes > room.players.length / 2) return toVoting(room);
  room.round++;
  room.finishVotes = new Set();
  room.phase = 'drawing';
  beginTurn(room);
}

function finish(room, caught, imposterWins, guess) {
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

function resolveVotes(room) {
  const tally = {};
  for (const target of Object.values(room.votes)) tally[target] = (tally[target] || 0) + 1;
  const max = Math.max(...Object.values(tally));
  const top = Object.keys(tally).filter((id) => tally[id] === max);
  if (top.length === 1 && top[0] === room.imposterId) {
    room.phase = 'guess';
    schedule(room, GUESS_SECS, () => finish(room, true, false, ''));
  } else finish(room, false, true, null);
}

const AVATAR_PARTS = [6, 6, 5];
const SKIN_DEFAULTS = ['#f28b82', '#f6b26b', '#f3d77a', '#9bd77f', '#7ed3ac', '#7fb8ec', '#b3a1ee', '#f29bd6'];
const cleanAvatar = (a) => [
  /^#[0-9a-f]{6}$/i.test(a?.[0]) ? a[0] : SKIN_DEFAULTS[Math.floor(Math.random() * SKIN_DEFAULTS.length)],
  ...AVATAR_PARTS.map((n, i) => (Number.isInteger(a?.[i + 1]) && a[i + 1] >= 0 && a[i + 1] < n ? a[i + 1] : Math.floor(Math.random() * n))),
];

function enter(ws, m) {
  if (ws.room) return;
  const name = String(m.name ?? '').trim().slice(0, 16);
  if (!name) return send(ws, { t: 'error', msg: 'Enter a name' });

  let room;
  if (m.t === 'create') {
    room = {
      code: makeCode(),
      hostId: null,
      players: [],
      settings: { mode: 'budget', budget: 800, rounds: 2, colors: true, timer: 30 },
      gameNo: 0,
      phase: 'lobby',
      notice: null,
    };
    rooms.set(room.code, room);
  } else {
    room = rooms.get(String(m.code ?? '').trim().toUpperCase());
    if (!room) return send(ws, { t: 'error', msg: 'Room not found' });
    if (room.phase !== 'lobby') return send(ws, { t: 'error', msg: 'Game already started' });
    if (room.players.length >= MAX_PLAYERS) return send(ws, { t: 'error', msg: 'Room is full' });
    if (room.players.some((q) => q.name.toLowerCase() === name.toLowerCase())) {
      return send(ws, { t: 'error', msg: 'Name already taken' });
    }
  }

  const p = {
    id: crypto.randomUUID().slice(0, 8),
    name,
    avatar: cleanAvatar(m.avatar),
    color: COLORS.find((c) => !room.players.some((q) => q.color === c)),
    ws,
  };
  room.players.push(p);
  if (m.t === 'create') room.hostId = p.id;
  ws.room = room;
  ws.player = p;
  broadcast(room);
}

function leave(ws) {
  const room = ws.room;
  if (!room) return;
  const p = ws.player;
  room.players = room.players.filter((q) => q !== p);
  if (!room.players.length) {
    clearTimer(room);
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === p.id) room.hostId = room.players[0].id;
  if (room.phase !== 'lobby') {
    resetToLobby(room);
    room.notice = `${p.name} left, so the game was reset.`;
  }
  broadcast(room);
}

function handle(ws, m) {
  if (m.t === 'create' || m.t === 'join') return enter(ws, m);
  const room = ws.room;
  const p = ws.player;
  if (!room) return;
  const isHost = room.hostId === p.id;

  switch (m.t) {
    case 'settings': {
      if (!isHost || room.phase !== 'lobby') return;
      const s = room.settings;
      if (['budget', 'free', 'single'].includes(m.mode)) s.mode = m.mode;
      if (typeof m.colors === 'boolean') s.colors = m.colors;
      if (TIMER_CHOICES.includes(m.timer)) s.timer = m.timer;
      if (Number.isFinite(m.budget)) s.budget = clamp(Math.round(m.budget), 50, 2000);
      if (Number.isFinite(m.rounds)) s.rounds = clamp(Math.round(m.rounds), 0, 5);
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

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (m && typeof m.t === 'string') handle(ws, m);
  });
  ws.on('close', () => leave(ws));
});

server.listen(PORT, () => console.log(`Fake Artist on http://localhost:${PORT}`));
