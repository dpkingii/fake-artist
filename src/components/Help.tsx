export function Help({ onClose }: { onClose: () => void }) {
  return (
    <div id="help" className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card modal" role="dialog" aria-label="How to play">
        <button className="alt x" onClick={onClose} aria-label="Close">&times;</button>
        <h2>How to play</h2>
        <p>Everyone builds one drawing together. All but one player know the secret word. The <b>fake artist</b> only knows the category and has to bluff.</p>
        <h3>Each turn</h3>
        <ul>
          <li>Players take turns adding to the shared canvas. Draw enough to show you know the word, but not so much that the fake artist can work it out.</li>
          <li><b>Ink budget mode:</b> each turn you get a limited amount of ink and can draw several strokes until it runs out.</li>
          <li><b>Free whiteboard mode:</b> draw as much as you like on your turn, then tap End turn.</li>
          <li><b>One stroke each mode:</b> one stroke per turn, any length.</li>
          <li><b>Rounds:</b> the host can set a fixed number of rounds, or pick "Until players vote to end". Then everyone votes after each round on whether the drawing is done, and a majority of yes ends it. During a round, tap Finish drawing to vote to stop early. If a majority of players do, it goes straight to the vote on who the fake is. Tap again to take your vote back.</li>
        </ul>
        <h3>Vote</h3>
        <p>When drawing ends, everyone secretly votes for who they think the fake artist is. A tie lets the fake artist escape.</p>
        <h3>Winning</h3>
        <ul>
          <li>If the fake artist is not caught, they win.</li>
          <li>If they are caught, they get one chance to guess the word. A right guess still wins it for them.</li>
          <li>Otherwise the real artists win.</li>
        </ul>
        <h3>One device</h3>
        <p>Each player taps their own card to see their role and word, and taps it again to hide it. Secret votes are passed around the device one player at a time.</p>
      </div>
    </div>
  );
}
