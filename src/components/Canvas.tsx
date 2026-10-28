import { useEffect, useRef, type PointerEvent } from 'react';
import { H, W, clamp, round1, type GameView, type StrokeData } from '../../shared/protocol';
import { INK, clearCanvas, drawStroke } from '../draw';
import { setInk } from '../ink';
import { net } from '../net';

interface Drawing {
  sid: string;
  stroke: StrokeData;
  pending: StrokeData['pts'];
}

interface Props {
  S: GameView;
  brush: number;
  replayN: number;
  className?: string;
}

export const turnKey = (S: GameView) => `${S.gameNo}:${S.turnNo}`;
export const isMyTurn = (S: GameView) => S.phase === 'drawing' && S.turnPlayer === S.you;
export const inkColor = (S: GameView, c: string) => (S.settings.colors || S.phase === 'result' ? c : INK);

export function Canvas({ S, brush, replayN, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ S, brush });
  latest.current = { S, brush };
  const st = useRef({
    strokes: [] as StrokeData[],
    drawing: null as Drawing | null,
    ink: { turn: '', left: 0 },
    usedTurn: '',
    redrawRaf: 0,
    replayRaf: 0,
  });

  const ctx = () => ref.current!.getContext('2d')!;

  const redraw = () => {
    const c = ctx();
    clearCanvas(c);
    for (const s of st.current.strokes) drawStroke(c, s, inkColor(latest.current.S, s.color));
  };

  const scheduleRedraw = () => {
    if (st.current.redrawRaf) return;
    st.current.redrawRaf = requestAnimationFrame(() => {
      st.current.redrawRaf = 0;
      redraw();
    });
  };

  useEffect(() => {
    const c = ref.current!;
    const s = st.current;
    const fit = () => {
      const w = Math.round(c.clientWidth * (window.devicePixelRatio || 1));
      if (!w || w === c.width) return;
      c.width = w;
      c.height = Math.round((w * H) / W);
      const g = c.getContext('2d')!;
      g.setTransform(w / W, 0, 0, w / W, 0, 0);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      redraw();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    const id = setInterval(() => flush(false), 40);
    const off = net.onStroke((m) => {
      let stroke = s.strokes.find((x) => x.sid === m.sid);
      if (!stroke) {
        stroke = { sid: m.sid, pid: m.pid, color: m.color, w: m.w, pts: [] };
        s.strokes.push(stroke);
      }
      stroke.pts.push(...m.pts);
      scheduleRedraw();
    });
    return () => {
      clearInterval(id);
      ro.disconnect();
      off();
      cancelAnimationFrame(s.redrawRaf);
      cancelAnimationFrame(s.replayRaf);
      s.redrawRaf = 0;
    };
  }, []);

  useEffect(() => {
    const s = st.current;
    if (s.drawing && !isMyTurn(S)) s.drawing = null;
    s.strokes = S.strokes.map((x) => ({ ...x, pts: x.pts.slice() }));
    if (s.drawing) {
      const i = s.strokes.findIndex((x) => x.sid === s.drawing!.sid);
      if (i < 0) s.strokes.push(s.drawing.stroke);
      else s.strokes[i] = s.drawing.stroke;
    }
    redraw();
  }, [S]);

  useEffect(() => {
    if (!replayN) return;
    const s = st.current;
    cancelAnimationFrame(s.replayRaf);
    const strokes = latest.current.S.strokes;
    const total = strokes.reduce((n, x) => n + x.pts.length, 0);
    const per = Math.max(1, Math.ceil(total / 180));
    let shown = 0;
    const step = () => {
      shown = Math.min(total, shown + per);
      const c = ctx();
      clearCanvas(c);
      let left = shown;
      for (const x of strokes) {
        drawStroke(c, x, inkColor(latest.current.S, x.color), Math.min(x.pts.length, left));
        left -= x.pts.length;
        if (left <= 0) break;
      }
      if (shown < total) s.replayRaf = requestAnimationFrame(step);
    };
    step();
    return () => cancelAnimationFrame(s.replayRaf);
  }, [replayN]);

  function flush(end: boolean) {
    const d = st.current.drawing;
    if (!d || (!d.pending.length && !end)) return;
    net.send({ t: 'stroke', sid: d.sid, w: d.stroke.w, pts: d.pending, end });
    d.pending = [];
  }

  function finishStroke() {
    const s = st.current;
    flush(true);
    s.drawing = null;
    if (latest.current.S.settings.mode === 'single') s.usedTurn = turnKey(latest.current.S);
  }

  const inkFor = () => {
    const S = latest.current.S;
    const key = turnKey(S);
    const s = st.current;
    if (s.ink.turn !== key) s.ink = { turn: key, left: S.inkLeft ?? 0 };
    return s.ink;
  };

  const pos = (e: PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [clamp(((e.clientX - r.left) * W) / r.width, 0, W), clamp(((e.clientY - r.top) * H) / r.height, 0, H)];
  };

  // Mirrors the server's ink arithmetic in onStroke so both sides agree when ink hits zero.
  function addPoint(raw: [number, number]) {
    const s = st.current;
    const d = s.drawing!;
    const last = d.stroke.pts[d.stroke.pts.length - 1];
    let p: [number, number] = [round1(raw[0]), round1(raw[1])];
    let spent = false;
    const ink = inkFor();
    if (last) {
      const dist = Math.hypot(p[0] - last[0], p[1] - last[1]);
      if (dist < 1) return;
      if (latest.current.S.settings.mode === 'budget') {
        if (dist >= ink.left) {
          const f = ink.left / dist;
          p = [round1(last[0] + (p[0] - last[0]) * f), round1(last[1] + (p[1] - last[1]) * f)];
          ink.left = 0;
        } else {
          ink.left -= dist;
          if (ink.left < 0.5) ink.left = 0;
        }
        spent = ink.left === 0;
      }
    }
    d.stroke.pts.push(p);
    d.pending.push(p);
    scheduleRedraw();
    setInk({ ...ink });
    if (spent) finishStroke();
  }

  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const { S, brush } = latest.current;
    const s = st.current;
    if (!isMyTurn(S) || s.drawing) return;
    const mode = S.settings.mode;
    if (mode === 'budget' ? inkFor().left <= 0 : mode === 'single' && s.usedTurn === turnKey(S)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const me = S.players.find((p) => p.id === S.you)!;
    const stroke: StrokeData = { sid: Math.random().toString(36).slice(2, 10), pid: S.you, color: me.color, w: brush, pts: [] };
    s.strokes.push(stroke);
    s.drawing = { sid: stroke.sid, stroke, pending: [] };
    addPoint(pos(e));
  };

  const onUp = () => {
    if (st.current.drawing) finishStroke();
  };

  return (
    <canvas
      id="cv"
      ref={ref}
      className={`${isMyTurn(S) ? 'mine' : ''} ${className ?? ''}`.trim()}
      onPointerDown={onDown}
      onPointerMove={(e) => { if (st.current.drawing) addPoint(pos(e)); }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  );
}
