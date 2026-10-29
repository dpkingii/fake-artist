export const W = 800;
export const H = 600;
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 8;
export const TIMER_CHOICES = [0, 15, 30, 60];

export const PEN_COLORS = ['#d8607a', '#5fae6e', '#6a82cc', '#e09a5c', '#9a69b3', '#4f9a9a', '#a08060', '#cf7fc0'];
export const SKINS = ['#f28b82', '#f6b26b', '#f3d77a', '#9bd77f', '#7ed3ac', '#7fb8ec', '#b3a1ee', '#f29bd6'];
export const AVATAR_PARTS = [6, 6, 5] as const;

export const round1 = (n: number) => Math.round(n * 10) / 10;
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export type Avatar = [color: string, eyes: number, mouth: number, accessory: number];
export type Mode = 'budget' | 'free' | 'single';
export type Phase = 'lobby' | 'drawing' | 'doneVote' | 'voting' | 'guess' | 'result';
export type Pt = [number, number];

export interface Settings {
  mode: Mode;
  budget: number;
  rounds: number;
  colors: boolean;
  timer: number;
}

export interface PlayerView {
  id: string;
  name: string;
  color: string;
  avatar: Avatar;
}

export interface StrokeData {
  sid: string;
  pid: string;
  color: string;
  w: number;
  pts: Pt[];
}

export interface GameResult {
  caught: boolean;
  imposterWins: boolean;
  guess: string | null;
  word: string;
  imposterId: string;
  votes: Record<string, string>;
}

interface BaseView {
  t: 'state';
  code: string;
  you: string;
  hostId: string;
  players: PlayerView[];
  settings: Settings;
  notice: string | null;
  gameNo: number;
  msLeft: number | null;
}

export interface LobbyView extends BaseView {
  phase: 'lobby';
}

export interface GameView extends BaseView {
  phase: Exclude<Phase, 'lobby'>;
  category: string;
  isImposter: boolean;
  word: string | null;
  imposterId: string | null;
  revealVotes: Record<string, string> | null;
  order: string[];
  turnPlayer: string | null;
  turnNo: number;
  round: number;
  inkLeft: number | null;
  strokes: StrokeData[];
  finishVotes: number;
  youFinishVoted: boolean;
  doneVotes: number;
  youDoneVoted: boolean;
  voteCount: number;
  youVoted: boolean;
  result: GameResult | null;
}

export type StateView = LobbyView | GameView;

export interface StrokeRelay {
  t: 'stroke';
  sid: string;
  pid: string;
  color: string;
  w: number;
  pts: Pt[];
  end: boolean;
}

export interface ErrorMsg {
  t: 'error';
  msg: string;
}

export type ServerMsg = StateView | StrokeRelay | ErrorMsg;

export type EnterMsg = { t: 'create' | 'join'; name?: string; avatar?: Avatar; color?: string; code?: string };

export type ClientMsg =
  | EnterMsg
  | ({ t: 'settings' } & Partial<Settings>)
  | { t: 'color'; color: string }
  | { t: 'start' }
  | { t: 'stroke'; sid: string; w?: number; pts: Pt[]; end: boolean }
  | { t: 'endTurn' }
  | { t: 'finishDrawing' }
  | { t: 'doneVote'; yes: boolean }
  | { t: 'vote'; target: string }
  | { t: 'guess'; guess: string }
  | { t: 'again' };
