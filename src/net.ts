import { useSyncExternalStore } from 'react';
import type { Avatar, ClientMsg, GameView, Phase, ServerMsg, StateView, StrokeRelay } from '../shared/protocol';
import { unlockAudio } from './sound';

interface Conn {
  ws: WebSocket;
  S: StateView | null;
  deadline: number | null;
}

export type View = 'home' | 'local' | 'room';

export interface NetSnapshot {
  view: View;
  S: StateView | null;
  deadline: number | null;
  local: boolean;
  quick: boolean;
  active: number;
  connStates: StateView[];
  err: string;
}

const wsUrl = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

/**
 * Owns the websocket(s) and publishes the active connection's latest state.
 * Local mode opens one connection per player on the same device; `active` is whoever should hold the device next.
 */
class Net {
  private conns: Conn[] = [];
  private active = 0;
  private local = false;
  private quick = false;
  private view: View = 'home';
  private err = '';
  private joinQueue: [string, Avatar, string][] = [];
  private syncTimer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  private strokeListeners = new Set<(m: StrokeRelay) => void>();
  private snap: NetSnapshot = this.build();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  getSnapshot = () => this.snap;

  onStroke(fn: (m: StrokeRelay) => void) {
    this.strokeListeners.add(fn);
    return () => { this.strokeListeners.delete(fn); };
  }

  private build(): NetSnapshot {
    const cur = this.conns[this.active];
    return {
      view: this.view,
      S: cur?.S ?? null,
      deadline: cur?.deadline ?? null,
      local: this.local,
      quick: this.quick,
      active: this.active,
      connStates: this.conns.flatMap((c) => (c.S ? [c.S] : [])),
      err: this.err,
    };
  }

  private emit() {
    this.snap = this.build();
    this.listeners.forEach((fn) => fn());
  }

  private publish() {
    if (this.conns[this.active]?.S) this.view = 'room';
    this.emit();
  }

  private setErr(msg: string) {
    this.err = msg;
    this.emit();
  }

  private closeAll() {
    clearTimeout(this.syncTimer);
    this.conns.forEach((c) => { c.ws.onclose = null; c.ws.close(); });
    this.conns = [];
    this.active = 0;
  }

  private connect(first: ClientMsg, name: string, avatar: Avatar, color?: string) {
    const conn: Conn = { ws: new WebSocket(wsUrl()), S: null, deadline: null };
    conn.ws.onopen = () => conn.ws.send(JSON.stringify({ ...first, name, avatar, color }));
    conn.ws.onmessage = (e) => this.onMsg(conn, JSON.parse(e.data));
    conn.ws.onclose = () => this.setErr('Disconnected. Refresh to rejoin.');
    return conn;
  }

  private onMsg(conn: Conn, m: ServerMsg) {
    if (m.t === 'error') {
      this.err = m.msg;
      if (this.local) {
        this.closeAll();
        this.view = 'local';
      }
      return this.emit();
    }
    if (m.t === 'stroke') {
      if (conn === this.conns[this.active]) this.strokeListeners.forEach((fn) => fn(m));
      return;
    }
    conn.S = m;
    conn.deadline = m.msLeft === null ? null : Date.now() + m.msLeft;
    if (!this.local) {
      this.active = 0;
      return this.publish();
    }
    if (this.joinQueue.length) {
      this.joinQueue.forEach(([name, avatar, color]) => this.conns.push(this.connect({ t: 'join', code: m.code }, name, avatar, color)));
      this.joinQueue = [];
    }
    // All local connections get the same broadcast; wait for the burst to land before picking who plays next.
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => this.syncLocal(), 30);
  }

  private pickActive() {
    const gameOf = (c: Conn) => c.S as GameView;
    const G = this.conns[0]!.S!;
    const wants: Partial<Record<Phase, (c: Conn) => boolean>> = {
      drawing: (c) => c.S!.you === gameOf(this.conns[0]!).turnPlayer,
      voting: (c) => !gameOf(c).youVoted,
      guess: (c) => gameOf(c).isImposter,
    };
    const want = wants[G.phase];
    return want ? Math.max(0, this.conns.findIndex(want)) : 0;
  }

  private syncLocal() {
    if (this.conns.some((c) => !c.S) || this.conns[0]!.S!.players.length < this.conns.length) return;
    const host = this.conns[0]!;
    if (host.S!.phase === 'lobby' && host.S!.settings.timer) {
      host.ws.send(JSON.stringify({ t: 'settings', timer: 0 }));
      return;
    }
    this.active = this.pickActive();
    this.publish();
  }

  clearError() {
    this.setErr('');
  }

  create(name: string, avatar: Avatar) {
    this.open({ t: 'create' }, name, avatar);
  }

  join(name: string, code: string, avatar: Avatar) {
    this.open({ t: 'join', code: code.trim() }, name, avatar);
  }

  private open(first: ClientMsg, name: string, avatar: Avatar) {
    name = name.trim();
    if (!name) return this.setErr('Enter a name');
    this.err = '';
    this.closeAll();
    this.local = false;
    this.conns = [this.connect(first, name, avatar)];
    this.emit();
    unlockAudio();
  }

  showLocal() {
    this.view = 'local';
    this.emit();
  }

  startLocal(players: { name: string; avatar: Avatar; color: string }[], quick: boolean) {
    this.err = '';
    this.closeAll();
    this.local = true;
    this.quick = quick;
    this.joinQueue = players.slice(1).map((p): [string, Avatar, string] => [p.name, p.avatar, p.color]);
    this.conns = [this.connect({ t: 'create' }, players[0]!.name, players[0]!.avatar, players[0]!.color)];
    this.emit();
    unlockAudio();
  }

  leave() {
    this.closeAll();
    this.err = '';
    this.view = 'home';
    this.emit();
  }

  send(msg: ClientMsg) {
    const ws = this.conns[this.active]?.ws;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  doneVote(yes: boolean) {
    const voters = this.local ? this.conns : [this.conns[this.active]!];
    voters.forEach((c) => c.ws.send(JSON.stringify({ t: 'doneVote', yes })));
  }
}

export const net = new Net();
export const useNet = () => useSyncExternalStore(net.subscribe, net.getSnapshot);
