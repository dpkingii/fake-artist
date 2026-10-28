import type { CSSProperties } from 'react';
import type { PlayerView, StateView } from '../shared/protocol';
import { Av } from './avatar';

export const cssVar = (c: string) => ({ '--c': c }) as CSSProperties;

export const findPlayer = (S: StateView, id: string | null | undefined) => S.players.find((p) => p.id === id);

export function Chip({ p, on, suffix }: { p: PlayerView | undefined; on?: boolean; suffix?: string }) {
  return (
    <span className={`chip${on ? ' on' : ''}`} style={cssVar(p?.color ?? '#999')}>
      <Av a={p?.avatar} />
      {p?.name ?? '?'}
      {suffix}
    </span>
  );
}

export const PlayerChip = ({ S, id }: { S: StateView; id: string | null | undefined }) => <Chip p={findPlayer(S, id)} />;
