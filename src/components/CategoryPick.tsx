import { useState, type ReactNode } from 'react';
import { CATEGORIES, type CatVote, type StateView } from '../../shared/protocol';
import { Av } from '../avatar';
import { CatArt, tileColor } from '../catArt';
import { net } from '../net';
import { Chip, cssVar } from '../ui';

// Also shown, frozen with the final votes, behind the category reveal once the game has started.
export function CategoryPick({ S, local }: { S: Extract<StateView, { catVotes: unknown }>; local: boolean }) {
  const host = S.you === S.hostId;
  const votes = S.catVotes;
  const unvoted = S.players.filter((p) => !(p.id in votes));
  // On one device the votes go in one player at a time, so track whose vote the next tap is.
  const [voterPick, setVoterPick] = useState<string | null>(null);
  const voter = local ? (voterPick && S.players.some((p) => p.id === voterPick) ? voterPick : (unvoted[0] ?? S.players[0]!).id) : S.you;

  const vote = (category: CatVote) => {
    if (!local) return net.send({ t: 'catVote', category });
    net.sendAs(voter, { t: 'catVote', category });
    setVoterPick(unvoted.find((p) => p.id !== voter)?.id ?? voter);
  };

  const tile = (c: CatVote, className: string, label: ReactNode) => {
    const voters = S.players.filter((p) => votes[p.id] === c);
    return (
      <button key={c} className={`cat ${className}${votes[voter] === c ? ' sel' : ''}`} style={c === 'random' ? undefined : cssVar(tileColor(c))} onClick={() => vote(c)} aria-pressed={votes[voter] === c}>
        <CatArt c={c} />
        <span className="catname">{label}</span>
        <span className="voters">{voters.map((p) => <Av key={p.id} a={p.avatar} />)}</span>
      </button>
    );
  };

  return (
    <div id="catpick" className="card" inert={S.phase !== 'lobby'}>
      <h2>Vote on a category</h2>
      <p className="muted">The game starts once everyone has voted, or when the host starts it. Most votes wins, and ties are broken at random. Everyone sees the category, even the fake artist.</p>
      {local && (
        <div className="voterow">
          <span>Voting as</span>
          {S.players.map((p) => (
            <button key={p.id} className={`chipbtn${p.id === voter ? ' sel' : ''}`} onClick={() => setVoterPick(p.id)}>
              <Chip p={p} suffix={p.id in votes ? ' ✓' : ''} />
            </button>
          ))}
        </div>
      )}
      <div className="catgrid">
        {tile('random', 'random', 'Random')}
        {CATEGORIES.map((c) => tile(c, '', c))}
      </div>
      <p className="muted">{S.players.length - unvoted.length}/{S.players.length} voted</p>
      {host && (
        <div className="row">
          <button className="alt" onClick={() => net.send({ t: 'picking', open: false })}>Back</button>
          <button className="start" onClick={() => net.send({ t: 'start' })}>Start now</button>
        </div>
      )}
    </div>
  );
}
