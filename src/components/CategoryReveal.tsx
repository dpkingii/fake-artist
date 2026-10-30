import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, catRevealSecs, type Category, type GameView } from '../../shared/protocol';
import { CatArt, tileColor } from '../catArt';
import { sfx } from '../sound';
import { cssVar } from '../ui';

const STEPS = 18;
// Lets the last vote land on its tile before the popup covers the screen.
const DELAY_MS = 400;
const FADE_MS = 300;
// Ticks start fast and slow down, adding up to about 2.4s.
const tickMs = (k: number) => 50 + 250 * (k / STEPS) ** 2;

export function CategoryReveal({ S, onDone }: { S: GameView; onDone: () => void }) {
  const pool = S.catPool;
  const spin = pool.length > 1;
  const reel = useMemo(() => {
    const end = pool.indexOf(S.category as Category);
    return Array.from({ length: STEPS }, (_, k) => pool[(((end - (STEPS - 1 - k)) % pool.length) + pool.length) % pool.length]!);
  }, [pool, S.category]);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [step, setStep] = useState(spin ? 0 : STEPS - 1);
  const landed = step === STEPS - 1;
  const shown = spin ? reel[step]! : (S.category as Category);

  useEffect(() => {
    const total = catRevealSecs(pool.length) * 1000;
    let tick: ReturnType<typeof setTimeout> | undefined;
    const run = (k: number) => {
      setStep(k);
      if (k === STEPS - 1) return sfx.turn();
      sfx.blip();
      tick = setTimeout(() => run(k + 1), tickMs(k));
    };
    const timers = [
      setTimeout(() => {
        setOpen(true);
        if (spin) run(0);
        else sfx.turn();
      }, DELAY_MS),
      setTimeout(() => setClosing(true), total - FADE_MS),
      setTimeout(onDone, total),
    ];
    return () => { timers.forEach(clearTimeout); clearTimeout(tick); };
  }, []);

  if (!open) return null;

  const heading = landed ? 'The category is...'
    : pool.length === CATEGORIES.length ? 'Rolling the dice...'
    : 'Breaking the tie...';

  return (
    <div className={`overlay catreveal-bg${closing ? ' closing' : ''}`}>
      <div className="card modal catreveal" role="dialog" aria-label="Category">
        <h2>{heading}</h2>
        <div className={`cat${landed ? ' landed' : ''}`} style={cssVar(tileColor(shown))}>
          <div key={step} className={`reel${spin && !landed ? ' spin' : ''}`}>
            <CatArt c={shown} />
            <span className="catname">{shown}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
