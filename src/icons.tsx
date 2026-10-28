import type { ReactNode } from 'react';

const Svg = ({ size, children }: { size?: number; children: ReactNode }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="#3d3558" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const FakeIcon = () => (
  <Svg size={64}>
    <circle cx={32} cy={32} r={25} fill="#fff" />
    <path d="M23 26c0-6 4-9 9-9s9 3 9 9c0 7-9 7-9 13" />
    <circle cx={32} cy={48} r={2.5} fill="#3d3558" />
  </Svg>
);

export const ArtistIcon = () => (
  <Svg size={64}>
    <path d="M48 8l8 8-26 26-8-8z" fill="#ffd23f" />
    <path d="M22 34C12 36 12 46 7 56c12-2 22-4 23-14z" fill="#ff5fa2" />
  </Svg>
);

export const SoundIcon = () => (
  <Svg size={22}>
    <path d="M8 25h10l14-11v36L18 39H8z" fill="#3d3558" />
    <path d="M42 24c4 5 4 11 0 16M49 16c8 9 8 23 0 32" />
  </Svg>
);

export const MutedIcon = () => (
  <Svg size={22}>
    <path d="M8 25h10l14-11v36L18 39H8z" fill="#3d3558" />
    <path d="M42 24l14 16M56 24L42 40" />
  </Svg>
);

export const DiceIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#3d3558" strokeWidth={2} strokeLinejoin="round">
    <rect x={3} y={3} width={18} height={18} rx={4} fill="#fff" />
    {[[8.5, 8.5], [15.5, 8.5], [12, 12], [8.5, 15.5], [15.5, 15.5]].map(([x, y]) => (
      <circle key={`${x}-${y}`} cx={x} cy={y} r={1.4} fill="#3d3558" />
    ))}
  </svg>
);

export const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#3d3558" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
