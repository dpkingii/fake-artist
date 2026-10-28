import { useState } from 'react';
import type { GameView } from '../../shared/protocol';
import { net } from '../net';
import { cssVar, PlayerChip } from '../ui';
import { Av } from '../avatar';
import type { Reveal } from '../reveal';

const Round = ({ S }: { S: GameView }) => <span className="muted">Round {S.round}{S.settings.rounds ? ` of ${S.settings.rounds}` : ''}</span>;

function RevealView({ S, votes, imposterId, reveal }: { S: GameView; votes: Record<string, string>; imposterId: string; reveal: Reveal }) {
  return (
    <>
      <h2>And the fake artist is...</h2>
      {reveal.stage === 0
        ? Object.entries(votes).slice(0, reveal.shown).map(([a, b]) => (
            <div className="vline" key={a}><PlayerChip S={S} id={a} /> &#10142; <PlayerChip S={S} id={b} /></div>
          ))
        : <div className="big"><PlayerChip S={S} id={imposterId} /></div>}
    </>
  );
}

function Guess() {
  const [guess, setGuess] = useState('');
  return (
    <div className="row">
      <input id="guess" placeholder="The word is..." maxLength={40} value={guess} onChange={(e) => setGuess(e.target.value)} />
      <button onClick={() => net.send({ t: 'guess', guess })}>Guess</button>
    </div>
  );
}

function Result({ S, local, reveal }: { S: GameView; local: boolean; reveal: Reveal }) {
  const r = S.result!;
  if (reveal.stage < 2) return <RevealView S={S} votes={r.votes} imposterId={r.imposterId} reveal={reveal} />;
  const youWin = S.isImposter ? r.imposterWins : !r.imposterWins;
  const why = !r.caught ? 'The fake artist was not caught.'
    : r.imposterWins ? `Caught, but guessed "${r.guess}" correctly.`
    : `Caught, and guessed "${r.guess}".`;
  return (
    <>
      <h2 className={local ? '' : youWin ? 'win' : 'lose'}>{r.imposterWins ? 'The fake artist wins!' : 'The artists win!'}</h2>
      <p>{why} The word was <b>{r.word}</b>. Fake artist: <PlayerChip S={S} id={r.imposterId} /></p>
      <div className="row">
        <button className="alt" onClick={reveal.replay}>▶ Replay drawing</button>
        {S.you === S.hostId
          ? <button onClick={() => net.send({ t: 'again' })}>Play again</button>
          : <span className="muted">Waiting for the host...</span>}
      </div>
    </>
  );
}

export function Controls({ S, local, reveal }: { S: GameView; local: boolean; reveal: Reveal }) {
  const n = S.players.length;
  const mode = S.settings.mode;
  switch (S.phase) {
    case 'drawing': {
      if (S.turnPlayer !== S.you) return <div className="row"><PlayerChip S={S} id={S.turnPlayer} /> is drawing... <Round S={S} /></div>;
      const prompt = mode === 'budget' ? 'Your turn! Draw until your ink runs out.'
        : mode === 'single' ? <>Your turn! Draw <b>one stroke</b>, then lift.</>
        : 'Your turn! Draw as much as you like, then end your turn.';
      return <div className="row"><span className="turn">{prompt}</span><Round S={S} /></div>;
    }
    case 'doneVote':
      return S.youDoneVoted
        ? <p>Waiting for votes ({S.doneVotes}/{n})...</p>
        : (
          <>
            <p className="turn">Everyone has drawn. Is the picture finished?</p>
            <div className="row">
              <button onClick={() => net.doneVote(true)}>Yes, find the fake!</button>
              <button className="alt" onClick={() => net.doneVote(false)}>No, one more round</button>
            </div>
            <p className="muted">{S.doneVotes}/{n} voted</p>
          </>
        );
    case 'voting':
      return S.youVoted
        ? <p>Waiting for votes ({S.voteCount}/{n})...</p>
        : (
          <>
            <p className="turn">Who is the fake artist?</p>
            <div className="row">
              {S.players.filter((p) => p.id !== S.you).map((p) => (
                <button className="vote" key={p.id} style={cssVar(p.color)} onClick={() => net.send({ t: 'vote', target: p.id })}>
                  <Av a={p.avatar} />{p.name}
                </button>
              ))}
            </div>
          </>
        );
    case 'guess':
      if (reveal.guessRevealing) return <RevealView S={S} votes={S.revealVotes!} imposterId={S.imposterId!} reveal={reveal} />;
      return S.isImposter
        ? <><p className="turn">You were caught! Guess the word to steal the win.</p><Guess /></>
        : <p><PlayerChip S={S} id={S.imposterId} /> is the fake artist. They are guessing the word...</p>;
    case 'result':
      return <Result S={S} local={local} reveal={reveal} />;
  }
}
