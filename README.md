# Fake Artist

A multiplayer drawing and deduction game, in the spirit of *A Fake Artist Goes to New York*. Everyone adds to one shared drawing. All but one player know the secret word; the fake artist only knows the category and has to bluff. Play remotely with a room code, or pass one device around.

**Play it:** https://fake-artist-0awa.onrender.com/ (the free host sleeps when idle, so the first load can take up to a minute)

<p align="center"><img src="docs/home.png" alt="Fake Artist home screen" width="640"></p>

## Screenshots

| Lobby | Drawing |
| --- | --- |
| ![Lobby with room code and players](docs/lobby.png) | ![Drawing on the shared canvas](docs/drawing.jpg) |
| **Voting** | **Result** |
| ![Voting for the fake artist](docs/voting.jpg) | ![Result with the revealed word and fake artist](docs/result.jpg) |

## How a game works

1. **Set up.** The host picks a drawing mode, stroke colors, a turn timer, and how many rounds to play. By default it's a free whiteboard in all black with 15 second turns, and drawing continues until a majority votes that the picture is done.
2. **Vote on a category.** Everyone votes at the same time, and each tile shows who voted for it. The game starts as soon as everyone has voted, or when the host starts it early. Most votes wins. A tie, or a win for **Random**, spins a reel that lands on the category.
3. **Draw.** Players take turns adding to one canvas. The fake artist only sees the category.
4. **Find the fake.** Everyone votes on who the fake artist is. If they're caught, they get one guess at the word to steal the win. Guesses ignore case, spacing, and punctuation.

**Categories:** Animals, Food, Nature, Landmarks, Countries, Sports, Fantasy, Famous People, Characters, League of Legends, and Anime. Word lists live in `server/words.ts`, and the tile art lives in `src/catArt.tsx`.

**Drawing modes:** free whiteboard (draw freely, end your own turn), ink budget (limited ink per turn), or one stroke each.

## Tech stack

- **Client:** React 19 + TypeScript, built with Vite (`src/`). Drawing uses the HTML canvas at the display's native resolution.
- **Server:** Node 22 + TypeScript, `ws` WebSockets, authoritative in-memory game rooms (`server/`). The server also serves the built client from the same port.
- **Shared:** the wire protocol and constants live in `shared/protocol.ts` and are imported by both sides, so messages are type-checked end to end.
- **Tests:** Vitest integration tests that drive a real server over WebSockets (`server/rooms.test.ts`).
- **Tooling:** `tsx` for the dev server, `concurrently` to run both dev processes.
- **Deploy:** Docker (multi-stage `node:22-alpine` image), GitHub Actions CI, hosted on Render (`render.yaml`).

## Develop

```sh
npm install
npm run dev        # server on :3000, Vite on :5173 (proxies /ws)
npm test
npm run typecheck
```

Open http://localhost:5173.

## Production build

```sh
npm run build      # client -> dist/client, server -> dist/server
PORT=3000 npm start
```

The server serves the built client and the `/ws` socket from one port.

## Docker

```sh
docker build -t fake-artist .
docker run -p 3000:3000 fake-artist
```

## Deploy on Render

Rooms live in server memory, so run a single instance. The free tier sleeps after ~15 minutes idle and drops any open rooms.

1. In Render, choose **New > Blueprint** and select this repo. It reads `render.yaml` and builds the `Dockerfile`.
2. Render injects `PORT`, and `/healthz` is used as the health check.
3. Every push to `main` redeploys.

CI (`.github/workflows/ci.yml`) runs typecheck, tests, the build, and a Docker build on pushes to `main` and on PRs.
