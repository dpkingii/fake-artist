import { useState, type CSSProperties } from 'react';
import type { GameView } from '../../shared/protocol';
import { Av } from '../avatar';
import { ArtistIcon, FakeIcon } from '../icons';
import { cssVar } from '../ui';

interface Props {
  states: GameView[];
  onDone: () => void;
}

export function Cards({ states, onDone }: Props) {
  const [open, setOpen] = useState(-1);
  const [seen, setSeen] = useState<ReadonlySet<number>>(new Set());

  const flip = (i: number) => {
    if (seen.has(i) && open !== i) return;
    const opening = open !== i;
    setOpen(opening ? i : -1);
    if (opening) setSeen(new Set(seen).add(i));
  };

  const ready = seen.size === states.length;
  return (
    <div id="cards" className="card">
      <h2>Find your card</h2>
      <p className="muted">Tap your own card to see your role, then tap it again to hide it before passing the device.</p>
      <div className="cardgrid" style={{ '--h': `${states.length > 4 ? 230 : 280}px` } as CSSProperties}>
        {states.map((c, i) => {
          const you = c.players.find((p) => p.id === c.you)!;
          return (
            <div key={c.you} className={`flipcard${open === i ? ' open' : ''}${seen.has(i) ? ' seen' : ''}`} onClick={() => flip(i)}>
              <div className="inner">
                <div className="face back" style={cssVar(you.color)}>
                  <Av a={you.avatar} /><span>{you.name}</span><i>✓</i>
                </div>
                <div className={`face front${c.isImposter ? ' fake' : ''}`}>
                  {c.isImposter ? (
                    <>
                      <div className="role"><FakeIcon /></div><b>FAKE ARTIST</b><small>Category</small><b>{c.category}</b><small>You don't know the word</small>
                    </>
                  ) : (
                    <>
                      <div className="role"><ArtistIcon /></div><b>ARTIST</b><small>{c.category}</small><b className="word">{c.word}</b>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button className="start" disabled={!ready} onClick={onDone}>
        {ready ? 'Start drawing' : `Waiting for everyone (${seen.size}/${states.length})`}
      </button>
    </div>
  );
}
