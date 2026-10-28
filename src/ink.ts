import { useSyncExternalStore } from 'react';

export interface InkLevel {
  turn: string;
  left: number;
}

let level: InkLevel = { turn: '', left: 0 };
const subs = new Set<() => void>();

export const setInk = (next: InkLevel) => {
  level = next;
  subs.forEach((fn) => fn());
};

export const useInk = () =>
  useSyncExternalStore(
    (fn) => { subs.add(fn); return () => { subs.delete(fn); }; },
    () => level,
  );
