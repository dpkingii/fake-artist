import type { ReactNode } from 'react';
import { net } from '../net';
import type { LobbyView, Mode } from '../../shared/protocol';

const MODE_NAMES: Record<Mode, string> = { budget: 'Ink budget', free: 'Free whiteboard', single: 'One stroke each' };

const Field = ({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) => (
  <label className={`field${wide ? ' wide' : ''}`}>{label} {children}</label>
);

export function Lobby({ S, local }: { S: LobbyView; local: boolean }) {
  const s = S.settings;
  const host = S.you === S.hostId;
  const num = (key: 'timer' | 'budget' | 'rounds') => (e: { target: { value: string } }) => net.send({ t: 'settings', [key]: Number(e.target.value) });

  return (
    <div id="lobby" className="card">
      {S.notice && <p className="note">{S.notice}</p>}
      {host ? (
        <>
          <div className="settings">
            <Field label="Mode" wide>
              <select value={s.mode} onChange={(e) => net.send({ t: 'settings', mode: e.target.value as Mode })}>
                <option value="budget">Ink budget: limited ink per turn</option>
                <option value="free">Free whiteboard: draw freely, end your own turn</option>
                <option value="single">One stroke each: one stroke per turn, vote when done</option>
              </select>
            </Field>
            <Field label="Stroke colors">
              <select value={s.colors ? 'on' : 'off'} onChange={(e) => net.send({ t: 'settings', colors: e.target.value === 'on' })}>
                <option value="on">Color per player</option>
                <option value="off">All black</option>
              </select>
            </Field>
            {!local && (
              <Field label="Timer">
                <select value={s.timer} onChange={num('timer')}>
                  <option value={0}>Off</option>
                  <option value={15}>15s turns</option>
                  <option value={30}>30s turns</option>
                  <option value={60}>60s turns</option>
                </select>
              </Field>
            )}
            {s.mode === 'budget' && (
              <Field label="Ink per turn">
                <select value={s.budget} onChange={num('budget')}>
                  <option value={400}>Short</option>
                  <option value={800}>Medium</option>
                  <option value={1500}>Long</option>
                </select>
              </Field>
            )}
            <Field label="Rounds">
              <select value={s.rounds} onChange={num('rounds')}>
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                <option value={0}>Until players vote to end</option>
              </select>
            </Field>
          </div>
          <button className="start" disabled={S.players.length < 3} onClick={() => net.send({ t: 'start' })}>Start game</button>
        </>
      ) : (
        <>
          <div className="pills">
            <span className="pill">{MODE_NAMES[s.mode]}</span>
            <span className="pill">{s.timer ? `${s.timer}s turns` : 'No timer'}</span>
            <span className="pill">{s.colors ? 'Color per player' : 'All black'}</span>
            <span className="pill">{s.rounds ? `${s.rounds} round${s.rounds > 1 ? 's' : ''}` : 'Vote to end'}</span>
          </div>
          <p>Waiting for the host to start...</p>
        </>
      )}
      {S.players.length < 3 && !local && <p className="muted">Need at least 3 players. Share room code <b>{S.code}</b>.</p>}
    </div>
  );
}
