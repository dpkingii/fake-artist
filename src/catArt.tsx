import type { ReactNode } from 'react';
import { CATEGORIES, type Category, type CatVote } from '../shared/protocol';

const TILE_COLORS = ['#f3d77a', '#eb92b2', '#b3a1ee', '#f6b26b', '#8fd0d6', '#9bd77f', '#f29bd6', '#7fb8ec', '#7ed3ac', '#d98f8f', '#a5b8f0'];
export const tileColor = (c: Category) => TILE_COLORS[CATEGORIES.indexOf(c) % TILE_COLORS.length]!;

const ART: Record<CatVote, ReactNode> = {
  random: (
    <>
      <rect x={10} y={10} width={44} height={44} rx={9} />
      {[[21, 21], [43, 21], [32, 32], [21, 43], [43, 43]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={3.5} fill="#3d3558" />)}
    </>
  ),
  Animals: (
    <>
      <path d="M14 26L12 8l14 10q6-2 12 0l14-10-2 18q6 10 0 20-8 10-18 10T14 46q-6-10 0-20z" />
      <circle cx={24} cy={34} r={2.5} fill="#3d3558" />
      <circle cx={40} cy={34} r={2.5} fill="#3d3558" />
      <path d="M30 41h4l-2 3zM6 40l14 2M6 48l14-3M58 40l-14 2M58 48l-14-3" />
    </>
  ),
  Food: (
    <>
      <path d="M8 14q24-12 48 0L32 60z" />
      <path d="M12 21q20-9 40 0" />
      <circle cx={26} cy={28} r={4} />
      <circle cx={38} cy={30} r={4} />
      <circle cx={32} cy={42} r={3.5} />
    </>
  ),
  Nature: (
    <>
      <circle cx={50} cy={13} r={6} />
      <path d="M6 58h52" />
      <path d="M23 58V40h6v18z" />
      <circle cx={26} cy={28} r={15} />
    </>
  ),
  Landmarks: (
    <>
      <path d="M32 4l4 18q4 16 16 36H40q-4-12-8-12t-8 12H12q12-20 16-36z" />
      <path d="M26 22h12M22 36h20" />
    </>
  ),
  Countries: (
    <>
      <circle cx={32} cy={32} r={25} />
      <path d="M7 32h50M32 7q-12 25 0 50M32 7q12 25 0 50M11 20h42M11 44h42" />
    </>
  ),
  Sports: (
    <>
      <circle cx={32} cy={32} r={24} />
      <path d="M8 32h48M32 8v48M15 15q14 17 0 34M49 15q-14 17 0 34" />
    </>
  ),
  Fantasy: (
    <>
      <path d="M32 4l14 42H18z" />
      <path d="M6 48q26 10 52 0-26-8-52 0z" />
      <path d="M30 24l2-5 2 5 5 2-5 2-2 5-2-5-5-2z" />
      <path d="M50 12l1.5-4 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5z" />
    </>
  ),
  'Famous People': (
    <>
      <path d="M10 6h44v52H10z" />
      <circle cx={32} cy={26} r={9} />
      <path d="M16 58q2-18 16-18t16 18" />
    </>
  ),
  Characters: (
    <>
      <path d="M4 16q14-10 28 0 14-10 28 0-1 30-16 30-9 0-12-10-3 10-12 10Q5 46 4 16z" />
      <path d="M12 26q6-6 13 0-6 6-13 0zM39 26q7-6 13 0-7 6-13 0z" fill="#3d3558" />
    </>
  ),
  'League of Legends': (
    <>
      <path d="M44 9A25 25 0 1 1 20 9" fill="none" />
      <path d="M17 8h14l-3 4v34h16l6-6v12H17l3-4V12z" />
    </>
  ),
  Anime: (
    <>
      <path d="M6 22q26-14 52 0M10 24q-2 18 14 22h16q16-4 14-22" />
      <ellipse cx={32} cy={34} rx={11} ry={13} fill="#3d3558" />
      <circle cx={27} cy={29} r={4} />
      <circle cx={36} cy={39} r={2} />
      <path d="M52 8l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
    </>
  ),
};

export const CatArt = ({ c }: { c: CatVote }) => (
  <svg className="catart" viewBox="0 0 64 64" fill="#fff" stroke="#3d3558" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ART[c]}
  </svg>
);
