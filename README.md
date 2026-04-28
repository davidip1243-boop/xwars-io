# Xwars

A browser prototype of the paper grid game. This version is local player vs bot, with the game rules kept in plain JavaScript so the rules can be tuned easily before adding online multiplayer.

## Play

Run the online server from this folder:

```sh
npm start
```

Then open:

```text
http://localhost:5173
```

For online play, both players open the same URL, enter the same room name, and press `Go online`. The first player becomes blue; the second becomes red.

## Deployment

The project is named `xwars-io` for hosting.

Vercel can host the browser game as a static site, but Vercel Functions do not keep WebSocket room connections open. That means the built-in `server.js` room server is for local/custom Node hosting, not Vercel multiplayer rooms.

For real online rooms in production, host `server.js` on a WebSocket-capable Node platform such as Render, Railway, Fly.io, or a VPS. The repo includes `render.yaml` and a `Dockerfile` for that.

After the online server is deployed, set its URL in `online-config.js`:

```js
window.XWARS_ONLINE_SERVER = "https://your-xwars-online-server.example.com";
```

The Vercel game will keep serving the page, while rooms and moves connect to that always-on server.

## Current Rules

- You start with the blue base near the top-left.
- The bot starts with the red base near the bottom-right.
- Each turn places up to 5 Xs.
- A move must touch your connected network of base, Xs, or titans, including diagonals.
- Placing on an enemy X captures it and turns it into your titan square.
- Titans work like cable: they keep the path back to your base and can carry placements forward.
- Bases and titans cannot be placed over.
- If you cannot complete your 5 placements, or the next player has no legal move, that player loses.

## Modes

- Classic: 25x25 board.
- Extra Large: 50x50 board.
- Walls: 25x25 board with random wall blocks. Walls are at least 5 squares from either base and at least 3 squares apart from each other.

The board is viewed through a smooth 9x9 camera so squares stay readable. Scroll over the board to pan without snapping; Shift-scroll or horizontal trackpad scroll moves sideways. During the bot turn, the camera follows the bot side automatically.

## Server

`server.js` serves the static files and runs a tiny two-player WebSocket room relay at `/ws`. It uses only Node built-ins, so no install step is needed.
