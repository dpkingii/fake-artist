import { useEffect, useRef, useState } from 'react';
import { clamp, type GameView } from '../../shared/protocol';
import { net } from '../net';
import { sfx } from '../sound';
import { useInk } from '../ink';
import { findPlayer, PlayerChip } from '../ui';
import type { Reveal } from '../reveal';
import { Canvas, inkColor, isMyTurn, turnKey } from './Canvas';
import { Controls } from './Controls';
import { PlayerChips } from './PlayerChips';

export type Stage = 'cards' | 'pause' | 'gate' | null;

interface Props {
  S: GameView;
  deadline: number | null;
  local: boolean;
  quick: boolean;
  stage: Stage;
  reveal: Reveal;
  onPass: () => void;
}

const BRUSHES = [
  { w: 5, title: 'Thin', size: 8 },
  { w: 10, title: 'Medium', size: 15 },
  { w: 20, title: 'Thick', size: 26 },
];

function Banner({ S, local, quick }: { S: GameView; local: boolean; quick: boolean }) {
  const hideSecrets = local && !quick && S.phase !== 'result';
  const fake = !hideSecrets && S.isImposter && S.phase !== 'result';
  return (
    <div id="banner" className={fake ? 'fake' : ''}>
      {hideSecrets
        ? <>Category: <b>{S.category}</b></>
        : fake
        ? <>You are the <b>FAKE ARTIST</b>. Category: <b>{S.category}</b>.{S.phase === 'drawing' && ' Blend in!'}</>
        : <>Category: <b>{S.category}</b> &middot; Word: <b>{S.word}</b></>}
    </div>
  );
}

function Timer({ S, deadline, guessRevealing }: { S: GameView; deadline: number | null; guessRevealing: boolean }) {
  const [sec, setSec] = useState<number | null>(null);
  const lastSec = useRef<number | null>(null);
  const mine = isMyTurn(S) || (S.phase === 'voting' && !S.youVoted) || (S.phase === 'doneVote' && !S.youDoneVoted) || (S.phase === 'guess' && S.isImposter);
  const off = deadline === null || S.phase === 'result' || guessRevealing;

  useEffect(() => {
    if (off) {
      lastSec.current = null;
      setSec(null);
      return;
    }
    const tick = () => {
      const s = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSec(s);
      if (mine && s > 0 && s <= 5 && s !== lastSec.current) sfx.tick();
      lastSec.current = s;
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [off, deadline, mine]);

  return <div id="timer" className={`timer${sec !== null && sec <= 5 ? ' hot' : ''}`} hidden={sec === null}>{sec}</div>;
}

function InkBar({ S }: { S: GameView }) {
  const level = useInk();
  const show = S.settings.mode === 'budget' && S.phase === 'drawing';
  const left = isMyTurn(S) && level.turn === turnKey(S) ? level.left : S.inkLeft ?? 0;
  const tp = findPlayer(S, S.turnPlayer);
  return (
    <div id="ink" hidden={!show}>
      <div id="inkfill" style={{ width: `${clamp(left / S.settings.budget, 0, 1) * 100}%`, background: tp ? inkColor(S, tp.color) : undefined }} />
    </div>
  );
}

function Overlay({ S, stage, onPass }: { S: GameView; stage: Stage; onPass: () => void }) {
  const me = findPlayer(S, S.you);
  return (
    <div id="nextup" hidden={stage !== 'pause' && stage !== 'gate'}>
      {stage === 'pause' && (
        <>
          <h2>Next up</h2>
          <div className="big"><PlayerChip S={S} id={S.turnPlayer} /></div>
          <p className="muted">Get ready...</p>
        </>
      )}
      {stage === 'gate' && (
        <>
          <h2>Pass the device to</h2>
          <div className="big"><PlayerChip S={S} id={S.you} /></div>
          <p>{S.phase === 'voting' ? 'Secret vote: who is the fake artist?' : 'Time to make your guess.'} Everyone else, look away!</p>
          <button className="start" onClick={onPass}>I'm {me?.name}, show me</button>
        </>
      )}
    </div>
  );
}

export function Game({ S, deadline, local, quick, stage, reveal, onPass }: Props) {
  const [brush, setBrush] = useState(10);
  const myTurn = isMyTurn(S);
  const key = turnKey(S);
  const announced = useRef('');
  const mode = S.settings.mode;

  useEffect(() => {
    if (myTurn && announced.current !== key) {
      announced.current = key;
      sfx.turn();
    }
  }, [myTurn, key]);

  return (
    <div id="game" className={`card${stage === 'gate' ? ' gated' : ''}`}>
      <div id="bar">
        <Banner S={S} local={local} quick={quick} />
        <Timer S={S} deadline={deadline} guessRevealing={reveal.guessRevealing} />
      </div>
      <div id="side"><PlayerChips S={S} local={local} /></div>
      <div id="stage" className={S.phase !== 'drawing' ? 'small' : ''}>
        <Canvas S={S} brush={brush} replayN={reveal.replayN} />
        <Overlay S={S} stage={stage} onPass={onPass} />
      </div>
      <div id="right">
        <div id="controls" className={S.phase === 'result' ? 'result' : ''}>
          <Controls S={S} local={local} reveal={reveal} />
        </div>
        <div id="tools">
          <InkBar S={S} />
          <div id="brushes" hidden={S.phase !== 'drawing'}>
            <span>Brush</span>
            {BRUSHES.map((b) => (
              <button key={b.w} className={`brush${brush === b.w ? ' sel' : ''}`} onClick={() => setBrush(b.w)} title={b.title}>
                <i style={{ width: b.size, height: b.size }} />
              </button>
            ))}
            <span id="endbtns">
              <button id="endbtn" className="alt" hidden={!myTurn || mode === 'single'} onClick={() => net.send({ t: 'endTurn' })}>
                {mode === 'budget' ? 'End turn early' : 'End turn'}
              </button>
              <button id="finbtn" className={`alt${S.youFinishVoted ? ' sel' : ''}`} hidden={S.phase !== 'drawing' || S.settings.rounds > 0} onClick={() => net.send({ t: 'finishDrawing' })}>
                Finish drawing ({S.finishVotes}/{S.players.length})
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
