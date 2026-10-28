import { useEffect, useState } from 'react';
import { Help } from './components/Help';
import { Home } from './components/Home';
import { LocalSetup } from './components/LocalSetup';
import { Room } from './components/Room';
import { useNet } from './net';

export default function App() {
  const n = useNet();
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setHelp(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <div id="wrap">
        <div className="loghead">
          <h1 className="logo">Fake Artist</h1>
          <button className="infobtn" onClick={() => setHelp(true)} title="How to play" aria-label="How to play">i</button>
        </div>
        <div id="err">{n.err}</div>
        <Home hidden={n.view !== 'home'} />
        <LocalSetup hidden={n.view !== 'local'} />
        {n.view === 'room' && n.S && <Room n={n} onHelp={() => setHelp(true)} />}
      </div>
      {help && <Help onClose={() => setHelp(false)} />}
    </>
  );
}
