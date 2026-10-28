import type { StateView } from '../../shared/protocol';
import { Chip } from '../ui';

export function PlayerChips({ S, local }: { S: StateView; local: boolean }) {
  const ids = S.phase === 'lobby' ? S.players.map((p) => p.id) : S.order;
  return (
    <>
      {ids.map((id) => {
        const p = S.players.find((q) => q.id === id);
        const on = S.phase === 'drawing' && S.turnPlayer === id;
        return <Chip key={id} p={p} on={on} suffix={`${id === S.hostId ? ' ★' : ''}${id === S.you && !local ? ' (you)' : ''}`} />;
      })}
    </>
  );
}
