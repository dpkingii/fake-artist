import { useState } from 'react';
import { AVATAR_PARTS, SKINS, type Avatar } from '../../shared/protocol';
import { AvatarSvg, randomAv } from '../avatar';
import { ChevronIcon, DiceIcon } from '../icons';
import { net } from '../net';

// Top arrow row cycles the accessory (part 3), then eyes (1), then mouth (2).
const ARROW_ROWS = [3, 1, 2] as const;

export function Home({ hidden }: { hidden: boolean }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [av, setAv] = useState<Avatar>(randomAv);

  const setSkin = (c: string) => setAv((a) => [c.toLowerCase(), a[1], a[2], a[3]]);
  const cycle = (part: 1 | 2 | 3, d: number) =>
    setAv((a) => {
      const n = AVATAR_PARTS[part - 1]!;
      const next: Avatar = [...a];
      next[part] = (a[part] + d + n) % n;
      return next;
    });
  const arrows = (d: -1 | 1) => ARROW_ROWS.map((r) => (
    <button key={r} className={`arrow${d > 0 ? ' flip' : ''}`} onClick={() => cycle(r, d)} aria-label={d > 0 ? 'Next' : 'Previous'}><ChevronIcon /></button>
  ));

  return (
    <section id="home" className="homewrap" hidden={hidden}>
      <p className="tagline">Everyone adds to one drawing.<br />One of you has no idea what it is.</p>
      <div className="card home">
        <div className="homeleft">
          <div className="avpick">
            <div className="arrows">{arrows(-1)}</div>
            <div className="avcenter">
              <div className="av huge"><AvatarSvg a={av} /></div>
              <button className="dice" onClick={() => setAv(randomAv())} title="Randomize" aria-label="Randomize avatar"><DiceIcon /></button>
            </div>
            <div className="arrows">{arrows(1)}</div>
            <div className="swatches">
              {SKINS.map((c) => (
                <button key={c} className={`sw${av[0] === c ? ' sel' : ''}`} style={{ background: c }} onClick={() => setSkin(c)} aria-label={`Color ${c}`} />
              ))}
              <label className={`sw custom${SKINS.includes(av[0]) ? '' : ' sel'}`} title="Custom color">
                <input type="color" value={av[0]} onChange={(e) => setSkin(e.target.value)} aria-label="Custom color" />
              </label>
            </div>
          </div>
          <input placeholder="Enter your name" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="homeright">
          <input placeholder="Room code" maxLength={4} style={{ textTransform: 'uppercase' }} value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="go" onClick={() => net.join(name, code, av)}>Join!</button>
          <button className="blue" onClick={() => net.create(name, av)}>Create room</button>
          <button className="blue" onClick={() => net.showLocal()}>Play on one device</button>
        </div>
      </div>
    </section>
  );
}
