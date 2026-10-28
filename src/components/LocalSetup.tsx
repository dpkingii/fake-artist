import { useState } from 'react';
import { PEN_COLORS, type Avatar } from '../../shared/protocol';
import { AvatarSvg, randomAv } from '../avatar';
import { net } from '../net';

interface Entry {
  name: string;
  avatar: Avatar;
  color: string;
}

export function LocalSetup({ hidden }: { hidden: boolean }) {
  const [players, setPlayers] = useState<Entry[]>(() => [0, 1, 2].map((i) => ({ name: '', avatar: randomAv(), color: PEN_COLORS[i]! })));
  const [quick, setQuick] = useState(false);

  const edit = (i: number, patch: Partial<Entry>) => setPlayers((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const start = () => net.startLocal(players.map((p, i) => ({ name: p.name.trim() || `Player ${i + 1}`, avatar: p.avatar, color: p.color })), quick);

  return (
    <section id="local" className="card home" hidden={hidden}>
      <h2>Players on this device</h2>
      <div id="names">
        {players.map((p, i) => (
          <div className="join" key={i}>
            <button className="alt av-btn" onClick={() => edit(i, { avatar: randomAv() })} title="Change avatar" aria-label="Change avatar">
              <span className="av"><AvatarSvg a={p.avatar} /></span>
            </button>
            <label className="sw pen" style={{ background: p.color }} title="Pen color">
              <input type="color" value={p.color} onChange={(e) => edit(i, { color: e.target.value })} aria-label={`Pen color for player ${i + 1}`} />
            </label>
            <input value={p.name} placeholder={`Player ${i + 1}`} maxLength={16} onChange={(e) => edit(i, { name: e.target.value })} />
            {i >= 3 && <button className="alt icon" onClick={() => setPlayers((ps) => ps.filter((_, j) => j !== i))}>✕</button>}
          </div>
        ))}
      </div>
      <button className="alt" disabled={players.length >= 8} onClick={() => setPlayers((ps) => [...ps, { name: '', avatar: randomAv(), color: PEN_COLORS.find((c) => !ps.some((q) => q.color === c)) ?? PEN_COLORS[0]! }])}>+ Add player</button>
      <label className="check"><input type="checkbox" checked={quick} onChange={(e) => setQuick(e.target.checked)} /> Quick mode: skip cards and pass screens (for testing)</label>
      <button onClick={start}>Start game</button>
      <button className="alt" onClick={() => net.leave()}>Back</button>
    </section>
  );
}
