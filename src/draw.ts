import { W, H, type StrokeData } from '../shared/protocol';

export const INK = '#3d3558';

const rnd = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};
const hash = (str: string) => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 100003, 7);

// Wobble is seeded by stroke id so every client (and the replay) draws the identical sketchy line.
export function drawStroke(ctx: CanvasRenderingContext2D, s: StrokeData, color: string, n = s.pts.length) {
  if (n < 1) return;
  const seed = hash(s.sid);
  const w = s.w || 10;
  ctx.strokeStyle = ctx.fillStyle = color;
  const pass = (ox: number, oy: number, lw: number, alpha: number, amp: number, salt: number) => {
    const q = s.pts.slice(0, n).map((p, i) => [
      p[0] + ox + (rnd(seed + i * 2 + salt) - 0.5) * amp,
      p[1] + oy + (rnd(seed + i * 2 + 1 + salt) - 0.5) * amp,
    ] as [number, number]);
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lw;
    ctx.beginPath();
    const first = q[0]!;
    if (q.length === 1) {
      ctx.arc(first[0], first[1], lw / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.moveTo(first[0], first[1]);
    for (let i = 1; i < q.length - 1; i++) {
      const p = q[i]!, nx = q[i + 1]!;
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + nx[0]) / 2, (p[1] + nx[1]) / 2);
    }
    const last = q[q.length - 1]!;
    ctx.lineTo(last[0], last[1]);
    ctx.stroke();
  };
  pass(0, 0, w, 1, 0.6 + w * 0.12, 0);
  pass(rnd(seed) * 3 - 1.5, rnd(seed + 1) * 3 - 1.5, Math.max(1.5, w * 0.5), 0.35, 1 + w * 0.1, 99);
  ctx.globalAlpha = 1;
}

export function clearCanvas(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, W, H);
}
