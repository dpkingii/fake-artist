import { useEffect, useState } from 'react';
import type { GameView, StateView } from '../../shared/protocol';
import { net, type NetSnapshot } from '../net';
import { isMuted, setMuted } from '../sound';
import { useReveal } from '../reveal';
import { MutedIcon, SoundIcon } from '../icons';
import { turnKey } from './Canvas';
import { Cards } from './Cards';
import { Game, type Stage } from './Game';
import { Lobby } from './Lobby';
import { PlayerChips } from './PlayerChips';

function TopBar({ S, local, onHelp }: { S: StateView; local: boolean; onHelp: () => void }) {
  const [copied, setCopied] = useState(false);
  const [muted, setMutedState] = useState(isMuted());

  const copy = () => {
    void navigator.clipboard.writeText(S.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div id="top" className={`card${local ? ' local' : ''}`}>
      <div id="codestat" className="stat" hidden={local}>
        <small>Room code</small>
        <div className="copyrow">
          <span id="roomcode" className="code">{S.code}</span>
          <button id="copy" className="alt icon" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
        </div>
      </div>
      <div className="stat grow">
        <small id="plabel">Players ({S.players.length}/8)</small>
        <div id="players"><PlayerChips S={S} local={local} /></div>
      </div>
      <button className="alt icon infobtn" onClick={onHelp} title="How to play" aria-label="How to play">i</button>
      <button id="mute" className="alt icon" onClick={() => { setMuted(!muted); setMutedState(!muted); }}>
        {muted ? <MutedIcon /> : <SoundIcon />}
      </button>
      <button className="alt icon" onClick={() => net.leave()}>Leave</button>
    </div>
  );
}

export function Room({ n, onHelp }: { n: NetSnapshot; onHelp: () => void }) {
  const S = n.S!;
  const { local, quick, active } = n;
  const reveal = useReveal(S, local);
  const [cardsDone, setCardsDone] = useState(-1);
  const [pausedKey, setPausedKey] = useState<string | null>(null);
  const [passedKey, setPassedKey] = useState<string | null>(null);

  const key = S.phase === 'lobby' ? '' : turnKey(S);
  const gateKey = `${S.gameNo}:${S.phase}:${S.phase === 'lobby' ? '' : S.turnNo}:${active}`;

  let stage: Stage = null;
  if (local && !quick) {
    if (S.phase === 'drawing') stage = cardsDone !== S.gameNo ? 'cards' : pausedKey === key ? null : 'pause';
    else if ((S.phase === 'voting' || S.phase === 'guess') && !(S.phase === 'guess' && reveal.guessRevealing)) stage = gateKey === passedKey ? null : 'gate';
  }

  useEffect(() => {
    if (stage !== 'pause') return;
    const id = setTimeout(() => setPausedKey(key), 2000);
    return () => clearTimeout(id);
  }, [stage, key]);

  return (
    <section id="room">
      <TopBar S={S} local={local} onHelp={onHelp} />
      {stage === 'cards' && <Cards key={S.gameNo} states={n.connStates as GameView[]} onDone={() => setCardsDone(S.gameNo)} />}
      {S.phase === 'lobby' && <Lobby S={S} local={local} />}
      {S.phase !== 'lobby' && stage !== 'cards' && (
        <Game S={S} deadline={n.deadline} local={local} quick={quick} stage={stage} reveal={reveal} onPass={() => setPassedKey(gateKey)} />
      )}
    </section>
  );
}
