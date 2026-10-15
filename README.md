# Real-Time Collaborative Whiteboard

A browser whiteboard where several people draw together in real time. Each board lives at its own URL (for example `/board/abc123XYZ0`), so sharing the link is all it takes to invite someone. Boards are saved to MongoDB, so a board looks the same when anyone comes back to it, even after a server restart.

Built with React + Vite, the plain HTML canvas API, Node.js + Express + Socket.IO, and MongoDB (Mongoose). See [`spec.md`](spec.md) for the full specification and [`plan.md`](plan.md) for the build plan.

## Features

- **Freehand drawing** with mouse, trackpad, pen, or touch
- **Color and brush size**: a color picker, 8 preset swatches, and sizes 1–40
- **Eraser** that paints over anything underneath
- **Shapes**: rectangle, circle, and straight line, with a live preview while dragging
- **Clear board** for everyone, after a confirmation
- **Shareable rooms**: every board has its own URL, and boards are isolated from each other
- **Live sync**: changes appear for everyone on the board almost instantly
- **Persistence**: boards are saved to MongoDB and reload when you come back
- **Live cursors**: see other people's pointers, labeled with their names
- **Online users** list, with a rename option
- **Keyboard shortcuts**: P pen, E eraser, R rectangle, C circle, L line
- **Reconnects by itself**: drawings made while offline are sent once the connection is back, and are never duplicated
- **Works on phones**: the toolbar wraps and the board scales to the screen

## Architecture

```
 ┌──────────────────┐        WebSocket        ┌──────────────────────┐        ┌───────────┐
 │  Browser (User A)│ ◄─────────────────────► │                      │        │           │
 │  React + Canvas  │                         │   Node.js server     │ ◄────► │  MongoDB  │
 └──────────────────┘                         │   Express + Socket.IO│        │  (boards) │
 ┌──────────────────┐        WebSocket        │   - rooms per board  │        │           │
 │  Browser (User B)│ ◄─────────────────────► │   - presence (memory)│        └───────────┘
 │  React + Canvas  │                         │   - board cache      │
 └──────────────────┘                         └──────────────────────┘
```

**The golden rule:** a client draws its own changes immediately (so it feels instant), then tells the server. The server validates the change, stores it, and forwards it to everyone *else* in the room. Each client draws what it receives.

- The board is an **ordered list of vector elements** (strokes, rectangles, circles, lines), never an image. To draw a board, a client clears the canvas and draws each element in order.
- Every coordinate is in **board units** on a fixed 1600 × 900 board, scaled to fit each screen, so a drawing lands in the same place on every device.
- The server keeps each open board in memory and writes every change to MongoDB at the same time (a **write-through cache**). It removes a board from memory when its last user leaves.
- Who is online lives only in server memory, because it only matters while people are connected.

### Folder structure

```
├── package.json            # root scripts: dev, dev:lan, install:all, test
├── client/                 # React app (Vite)
│   ├── vercel.json         # SPA rewrite for Vercel
│   ├── public/_redirects   # SPA rewrite for Netlify
│   └── src/
│       ├── pages/          # Home (create/join) and Board
│       ├── components/     # Canvas, Toolbar, CursorLayer, OnlineUsers, NamePrompt, StatusBadge
│       └── lib/            # socket, draw, geometry, user, throttle, constants
└── server/
    └── src/
        ├── index.js        # startup: env vars, MongoDB, listen
        ├── app.js          # Express + Socket.IO setup (also used by tests)
        ├── config.js       # parses CLIENT_ORIGIN
        ├── db.js           # MongoDB connection
        ├── models/Board.js
        ├── boardStore.js   # in-memory cache + database writes
        ├── persistence/    # MongoDB and in-memory (test) storage
        ├── presence.js     # who is on which board
        ├── validate.js     # checks every incoming message
        └── sockets/boardHandlers.js
```

## Prerequisites

- **Node.js 20 or newer** (`node --version`)
- **MongoDB**: a local install, or a free MongoDB Atlas cluster (see [MongoDB](#mongodb))
- Git

## Setup

```bash
git clone <your repo URL> whiteboard
cd whiteboard
npm run install:all                     # installs root, server and client packages
cp server/.env.example server/.env
cp client/.env.example client/.env
```

On Windows PowerShell, use `copy` instead of `cp`. The default `.env` values work for local development as long as MongoDB is running locally.

### Environment variables

| File | Variable | Example | Meaning |
|------|----------|---------|---------|
| `server/.env` | `PORT` | `4000` | Port the server listens on. Hosting platforms set this for you. |
| `server/.env` | `CLIENT_ORIGIN` | `http://localhost:5173` | The client's address, with no trailing slash. List several separated by commas. |
| `server/.env` | `MONGODB_URI` | `mongodb://127.0.0.1:27017/whiteboard` | MongoDB connection string |
| `client/.env` | `VITE_SERVER_URL` | `http://localhost:4000` | The server's address. It is read when the client is built, so restart `npm run dev` or rebuild after changing it. |

Never commit the `.env` files; they are git-ignored.

## MongoDB

The server connects to MongoDB **before** it starts listening, and exits with a clear message if it can't connect within 5 seconds. Set the connection string as `MONGODB_URI` in `server/.env`.

### Option A: local install (Windows)

```powershell
winget install MongoDB.Server
```

This installs MongoDB as a Windows service that starts automatically. The default `.env` value already points to it:

```
MONGODB_URI=mongodb://127.0.0.1:27017/whiteboard
```

To stop or start it (run in an **administrator** terminal):

```powershell
net stop MongoDB
net start MongoDB
```

On macOS use `brew install mongodb-community` and `brew services start mongodb-community`; on Linux follow the official MongoDB install guide for your distribution.

To browse the data, install [MongoDB Compass](https://www.mongodb.com/products/compass) and connect to `mongodb://127.0.0.1:27017`. Boards are in the `whiteboard` database, `boards` collection.

### Option B: MongoDB Atlas (free cloud database)

1. Create a free account and a free (M0) cluster at https://www.mongodb.com/atlas.
2. Under **Database Access**, create a database user with a password.
3. Under **Network Access**, allow your IP address (or `0.0.0.0/0` for a deployed server, see [Deployment](#deployment)).
4. Click **Connect → Drivers** and copy the connection string. Put it in `server/.env`, adding the database name `whiteboard` after `.net/`:

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/whiteboard
```

If the password contains special characters such as `@`, `:` or `/`, URL-encode them (for example `@` becomes `%40`).

## Running

```bash
npm run dev
```

This starts the server (http://localhost:4000, restarts on file changes) and the client (http://localhost:5173) together. Open http://localhost:5173, click **Create new board**, and open the same link in a second browser window to see live sync.

To check that the server is up, open http://localhost:4000/health; it should show `{"ok":true}`.

## Testing

```bash
npm test
```

This runs the server tests and then the client tests (Vitest). No database is needed: the server tests use in-memory storage and start real Socket.IO servers on random ports. They cover validation, the board store, presence, CORS, and the socket events (sync, rooms, late joiners, cursors, error handling).

The client also has a linter and a production build:

```bash
npm run lint --prefix client
npm run build --prefix client
```

## Real-time event protocol

After a socket joins a board, the server remembers it in `socket.data.boardId`, so later events don't include the board ID, and a client can't write to a board it hasn't joined.

| Direction | Event | Payload | Sent to / when |
|-----------|-------|---------|----------------|
| Client → Server | `board:join` | `{ boardId, user: { userId, name, color } }` | When the board page opens, after every reconnect, and after a rename |
| Client → Server | `element:add` | `{ element }` | When a stroke or shape is finished |
| Client → Server | `board:clear` | *(none)* | After the user confirms "Clear board" |
| Client → Server | `cursor:move` | `{ x, y }` | Pointer moves over the board (at most every 50 ms) |
| Client → Server | `cursor:leave` | *(none)* | Pointer leaves the board |
| Server → Client | `board:state` | `{ elements }` | Only the user who just joined |
| Server → Client | `element:added` | `{ element }` | Everyone on the board except the sender |
| Server → Client | `board:cleared` | `{ by: name }` | Everyone on the board except the sender |
| Server → Client | `presence:update` | `{ users: [{ socketId, name, color }] }` | Everyone on the board, including the sender |
| Server → Client | `cursor:moved` | `{ socketId, name, color, x, y }` | Everyone on the board except the sender |
| Server → Client | `cursor:left` | `{ socketId }` | Everyone on the board except the sender |
| Server → Client | `error:message` | `{ message }` | Only the sender, when it sent invalid data or something failed |

The element format and the full details are in [spec.md, Sections 4 and 5](spec.md#4-data-model).

## Deployment

You need three free services: **MongoDB Atlas** for the database, **Render** (or Railway) for the server, and **Vercel** (or Netlify) for the client. The server must run on a host that supports WebSockets, which is why it can't go on Vercel or Netlify with the client.

Push the project to GitHub first; all three services deploy from your repository.

### 1. Database: MongoDB Atlas

Follow [Option B](#option-b-mongodb-atlas-free-cloud-database) above. Under **Network Access**, add `0.0.0.0/0` (allow from anywhere), because free hosting tiers don't have a fixed IP address. Your database user's password is what keeps the data safe, so make it a strong one.

### 2. Server: Render

1. On https://render.com, click **New → Web Service** and connect your GitHub repository.
2. Settings:
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
3. Environment variables:
   - `MONGODB_URI`: your Atlas connection string
   - `CLIENT_ORIGIN`: for now, `http://localhost:5173`. You'll change it after the client is deployed (step 4).
   - `NODE_ENV`: `production`
   - Don't set `PORT`; Render provides it.
4. Deploy. When the logs show `Connected to MongoDB` and `Server listening`, open `https://<your-service>.onrender.com/health`. It should show `{"ok":true}`.

**Railway instead:** create a project from your GitHub repo, set the service's **Root Directory** to `server`, add the same variables (not `PORT`), and use **Settings → Networking → Generate Domain** to get a public URL. Railway runs `npm start` automatically.

### 3. Client: Vercel

1. On https://vercel.com, click **Add New → Project** and import your repository.
2. Settings:
   - **Root Directory:** `client`
   - **Framework Preset:** Vite (detected automatically; build command `npm run build`, output directory `dist`)
3. Environment variable: `VITE_SERVER_URL` = `https://<your-service>.onrender.com` (no trailing slash).
4. Deploy. `client/vercel.json` sends every path to `index.html`, so refreshing a `/board/...` page works instead of showing a 404.

**Netlify instead:** **Add new site → Import an existing project**, then set **Base directory** `client`, **Build command** `npm run build`, **Publish directory** `client/dist`, and the same `VITE_SERVER_URL` variable. `client/public/_redirects` does the same job as `vercel.json`.

If you change `VITE_SERVER_URL` later, redeploy the client: the value is built into the JavaScript files.

### 4. Connect the two

Back on Render, set `CLIENT_ORIGIN` to your client's address exactly as the browser shows it, for example `https://my-whiteboard.vercel.app` (https, no trailing slash). Save; Render restarts the server.

To also allow the LAN demo below, list both: `https://my-whiteboard.vercel.app,http://192.168.1.20:5173`.

### 5. Check it

- Open the deployed site on your laptop and on your phone using **mobile data** (not Wi-Fi), on the same board.
- Drawings, cursors, and the online list sync both ways.
- Refreshing a `/board/...` page works.
- The drawing is still there the next day.

> Free tiers "sleep" after about 15 minutes without traffic, and the first request can then take 30–60 seconds. Open the app a few minutes before a demo to wake it up. While the server is waking, the badge shows "Disconnected — reconnecting…" and turns green by itself.

## Local network demo (backup plan)

If the internet or a hosting service fails during a demo, run everything on your laptop and open it from a phone on the **same Wi-Fi**.

1. Find your laptop's local IP address: `ipconfig` on Windows (the **IPv4 Address**), `ipconfig getifaddr en0` on macOS, or `hostname -I` on Linux. The steps below use `192.168.1.20`.
2. In `client/.env`:
   ```
   VITE_SERVER_URL=http://192.168.1.20:4000
   ```
3. In `server/.env` (keep localhost so the laptop still works):
   ```
   CLIENT_ORIGIN=http://localhost:5173,http://192.168.1.20:5173
   ```
4. Start both, with the client open to the network:
   ```bash
   npm run dev:lan
   ```
5. On the phone, open `http://192.168.1.20:5173`. On the laptop, use the same address (not `localhost`) so both share the same board links.

If the phone can't connect, the firewall is usually the cause. On Windows, allow Node.js on **private networks** when it asks, or in **Windows Defender Firewall → Allow an app**. Public or guest Wi-Fi often blocks devices from reaching each other; a phone hotspot is a reliable fallback. Change the `.env` files back to `localhost` afterwards.

## Known limitations

- No authentication: anyone with the link can view and edit a board.
- The same person in two tabs appears twice in the online list.
- Single server instance: running several servers would need the Socket.IO Redis adapter so rooms span all of them.
- A board is one MongoDB document, so very large boards could approach MongoDB's 16 MB document limit. The server caps a board at 10,000 elements.
- If two people finish a stroke at the same moment, they may briefly see the two in a different order (this only shows when an eraser overlaps). After a refresh everyone sees the server's order: a simple form of eventual consistency.
- Out of scope for this version: undo/redo, export, select/move, text, and zoom. See [spec.md Section 10](spec.md#10-future-work-next-phase) for how the design prepares for them.
