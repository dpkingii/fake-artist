import type { ReactNode } from 'react';
import { AVATAR_PARTS, SKINS, type Avatar } from '../shared/protocol';

const INK = '#3d3558';

const Dot = ({ x, y, r }: { x: number; y: number; r: number }) => <circle cx={x} cy={y} r={r} fill={INK} stroke="none" />;

const EYES: ReactNode[] = [
  <><Dot x={24} y={28} r={3.2} /><Dot x={40} y={28} r={3.2} /></>,
  <><path d="M18 21l11 5M46 21l-11 5" /><Dot x={25} y={30} r={2.8} /><Dot x={39} y={30} r={2.8} /></>,
  <path d="M19 30q5-8 10 0M35 30q5-8 10 0" />,
  <><circle cx={24} cy={28} r={6.5} fill="#fff" /><circle cx={40} cy={28} r={6.5} fill="#fff" /><Dot x={25.5} y={29} r={2.6} /><Dot x={38.5} y={29} r={2.6} /></>,
  <path d="M19 28h10M35 28h10" />,
  <path d="M20 24l8 8M28 24l-8 8M36 24l8 8M44 24l-8 8" />,
];

const MOUTHS: ReactNode[] = [
  <path d="M22 41q10 9 20 0" />,
  <path d="M22 47q10-9 20 0" />,
  <ellipse cx={32} cy={44} rx={6} ry={5} fill={INK} />,
  <path d="M24 44h16" />,
  <path d="M20 44l4-4 4 4 4-4 4 4 4-4 4 4" />,
  <><path d="M22 41q10 9 20 0" /><path d="M29 46q3 7 7 0z" fill="#ff5fa2" /></>,
];

const HATS: ReactNode[] = [
  null,
  <><rect x={21} y={-6} width={22} height={19} rx={2} fill="#5b4b8a" /><rect x={21} y={5} width={22} height={5} fill="#f3d77a" /><ellipse cx={32} cy={13} rx={16} ry={4} fill="#5b4b8a" /></>,
  <g transform="translate(46 14) rotate(18)" fill="#f58fb3"><path d="M0 0L-13-8V8z" /><path d="M0 0L13-8V8z" /><circle r={3.6} /></g>,
  <path d="M30 13L28 0M35 13L35 -1M40 13L43 1" strokeWidth={3.5} />,
  <path d="M31 13L29 0M37 13L40 1" strokeWidth={3.5} />,
];

export const DEFAULT_AVATAR: Avatar = [SKINS[2]!, 0, 0, 0];

export const randomAv = (): Avatar => [
  SKINS[Math.floor(Math.random() * SKINS.length)]!,
  ...(AVATAR_PARTS.map((n) => Math.floor(Math.random() * n)) as [number, number, number]),
];

export function AvatarSvg({ a }: { a: Avatar }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform="translate(2.6 7) scale(.92)">
        <path d="M3 58C3 28 14 12 32 12s29 16 29 46z" fill={a[0]} />
        {EYES[a[1]]}
        {MOUTHS[a[2]]}
        {HATS[a[3] ?? 0]}
      </g>
    </svg>
  );
}

export function Av({ a, className = '' }: { a?: Avatar; className?: string }) {
  return <span className={`av ${className}`.trim()}><AvatarSvg a={a ?? DEFAULT_AVATAR} /></span>;
}
