# plan.md — Implementation Plan for Claude Code

## Approved v2 delivery — 2026-10-26

### Approved follow-up: accounts and Azure

The user requested sign-up, sign-in, and migration to Azure after the studio upgrade. Add email/password accounts with hashed passwords, expiring HttpOnly sessions, server-side protection for sockets and images, and account-scoped local edit queues. Serve the client and API from one Azure App Service origin. Deploy only the F1 Free tier unless the user approves another price. Keep the existing hosts available until Azure is verified. Azure account sign-in and a remote Atlas connection string are required to finish deployment.

The user approved major upgrades and asked for delivery today without pausing for instructional reports at each step. This supersedes the v1 feature exclusions and one-phase pauses for this upgrade.

1. Add a versioned studio document and serialized, acknowledged editing protocol; preserve v1 boards and tests. Save images separately from the board document with bounded uploads.
2. Replace the basic workspace with a polished responsive studio: editable text/notes, images, selection/move/resize/lock/order/delete, undo/redo, pen/highlighter/shapes/arrows, zoom/pan.
3. Add up to 20 autosaved pages, thumbnails, names, add/duplicate/delete/navigation, backgrounds and useful templates, presentation mode, PNG/print-PDF export, and a tablet-friendly mode.
4. Run unit/integration/build checks and browser acceptance checks. Preserve existing deployed data and document deployment steps and remaining limitations.

Autosave replaces repeated save/discard prompts on each page switch. Persistent saves are acknowledged by the server; pending edits remain recoverable after reconnect. Presentation uses pages as slides. Learning/explanation features are secondary to delivering a stable submission.

> **Project:** Real-time collaborative whiteboard (coursework / learning project)
> **Companion document:** `spec.md` is the source of truth for features, data model, event protocol, and verification checklists. This file tells you (Claude Code) **how and in what order** to build it.

---

## 0. How to use this plan

**For the human:** put `spec.md` and `plan.md` in the root of an empty `whiteboard/` folder, open Claude Code there, and say:

> Read `plan.md` and `spec.md`. Implement **Phase 0** only, then stop and report.

After you've checked the phase yourself, say "Phase 0 verified, continue with Phase 1", and so on.

**For Claude Code:** read this whole file and `spec.md` before writing any code. Then follow the rules in Section 1 exactly.

---

## 1. Rules for Claude Code

1. **One phase at a time.** Implement only the phase you were asked for. Never start the next phase without the user's go-ahead.
2. **Stop and report** at the end of each phase using the template in Section 6.
3. **Follow `spec.md`.** Use its data model (Section 4), event names and payloads (Section 5), coordinate system (Section 6), and folder structure (Section 3.1). If something in the spec seems wrong or unclear, ask instead of guessing.
4. **Do not implement out-of-scope features**: no undo/redo, export, auth, select/move, text, zoom/pan, even if they would be easy.
5. **Dependencies:** use only the packages listed in Section 2. Ask before adding anything else.
6. **Language:** plain JavaScript (ES modules) and JSX. No TypeScript. No CSS frameworks; use plain CSS files.
7. **This is a learning project.** Keep code simple and readable over clever. Add short comments that explain *why* (not what) at the important spots: coordinate conversion, compositing for the eraser, room targeting, throttling, write-through cache, reconnection handling. Keep functions small and named clearly.
8. **Keep the app working at every phase.** Each phase must end with `npm run dev` starting cleanly and with no console errors.
9. **Run checks before reporting:** `npm run build` in `client/`, `npm test` in `server/` (from Phase 4 onward), and `npm test` in `client/` (from Phase 1 onward). Fix all failures before reporting.
10. **Git:** make one commit at the end of each phase with the message `Phase N: <short title>`. Never commit `.env` files or `node_modules`.
11. **Progress log:** after each phase, append an entry to `PROGRESS.md` (format in Section 6).
12. **Do not remove** earlier working behavior when adding new phases. If a refactor is needed, mention it in the report.

---

## 2. Tech stack and dependencies

| Area | Choice |
|------|--------|
| Runtime | Node.js 20+ |
| Client | React (latest stable) + Vite, `react-router-dom`, `socket.io-client`, `nanoid` |
| Client tests | `vitest` (dev) for pure functions only |
| Server | Express, `socket.io`, `cors`, `dotenv`, `mongoose`, `nanoid` |
| Server dev/test | `nodemon`, `vitest` (dev) |
| Root | `concurrently` (dev) to run client and server together |

Use the current major version of each package. Use `"type": "module"` in every `package.json`.

### 2.1 Shared constants

The client and server are separate packages, so keep **identical** copies of these constants in `client/src/lib/constants.js` and `server/src/constants.js`, each with a comment saying "keep in sync with the other copy":

```js
export const BOARD_WIDTH = 1600;
export const BOARD_HEIGHT = 900;
export const MIN_SIZE = 1;
export const MAX_SIZE = 40;
export const MAX_POINTS_PER_STROKE = 5000;
export const MAX_ELEMENTS_PER_BOARD = 10000;
export const MAX_NAME_LENGTH = 20;
export const CURSOR_THROTTLE_MS = 50;
export const BOARD_ID_REGEX = /^[A-Za-z0-9_-]{6,32}$/;
export const ELEMENT_TYPES = ["stroke", "rect", "circle", "line"];
```

### 2.2 Environment variables

`server/.env.example`:
```
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/whiteboard
```

`client/.env.example`:
```
VITE_SERVER_URL=http://localhost:4000
```

Create real `.env` files from these during Phase 0 and make sure `.env` is git-ignored.

---

## 3. Final file structure

```
whiteboard/
├── spec.md
├── plan.md
├── PROGRESS.md
├── README.md
├── package.json                 # root: "dev" runs client + server via concurrently
├── .gitignore
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── .env.example
│   ├── public/_redirects        # Phase 12 (Netlify)  — or vercel.json at client root
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── styles.css
│       ├── pages/
│       │   ├── Home.jsx
│       │   └── Board.jsx
│       ├── components/
│       │   ├── Canvas.jsx
│       │   ├── Toolbar.jsx
│       │   ├── StatusBadge.jsx
│       │   ├── CursorLayer.jsx
│       │   ├── OnlineUsers.jsx
│       │   └── NamePrompt.jsx
│       └── lib/
│           ├── constants.js
│           ├── socket.js
│           ├── draw.js
│           ├── geometry.js
│           ├── throttle.js
│           ├── user.js
│           └── __tests__/
│               ├── geometry.test.js
│               └── throttle.test.js
└── server/
    ├── package.json
    ├── .env.example
    └── src/
        ├── index.js             # starts the server (reads env, connects DB, listens)
        ├── app.js               # createServer({ store }) → { httpServer, io } (testable)
        ├── constants.js
        ├── db.js
        ├── models/Board.js
        ├── boardStore.js        # cache + pluggable persistence
        ├── persistence/
        │   ├── mongoPersistence.js
        │   └── memoryPersistence.js   # used in tests and before Phase 8
        ├── presence.js
        ├── validate.js
        ├── sockets/boardHandlers.js
        └── __tests__/
            ├── validate.test.js
            ├── boardStore.test.js
            ├── presence.test.js
            └── sockets.test.js  # integration tests with socket.io-client
```

### 3.1 Testability design (important)

- `server/src/app.js` exports `createServer({ store, clientOrigin })` which builds Express + Socket.IO and registers handlers, **without** calling `listen()` or connecting to MongoDB. `index.js` does the real startup.
- `boardStore.js` takes a persistence adapter with three async methods: `load(boardId) → elements[]`, `append(boardId, element)`, `clear(boardId)`. Use `memoryPersistence` until Phase 8 and in all tests; use `mongoPersistence` in production from Phase 8. This means tests never need a running MongoDB.
- Socket integration tests start the server on a random port (`listen(0)`), connect real `socket.io-client` instances, and assert on received events. Wrap event waits in a small `waitFor(socket, event, timeoutMs)` helper that returns a Promise.

---
## 4. Phase overview

Phases map one-to-one to the steps in `spec.md` Section 7. The **manual checks** for each phase are the "Verification checklist" of the matching spec step; the user runs those in the browser. Claude Code is responsible for the **automated checks** listed in this file.

| Phase | Spec step | Title | Server tests? | Client tests? |
|-------|-----------|-------|---------------|---------------|
| 0 | Step 0 | Project setup | – | – |
| 1 | Step 1 | Freehand pen (single user) | – | geometry |
| 2 | Step 2 | Color, size, eraser, clear | – | – |
| 3 | Step 3 | Shapes | – | shape math |
| 4 | Step 4 | Socket.IO connection | connection test | – |
| 5 | Step 5 | Live sync (one shared board) | broadcast tests | – |
| 6 | Step 6 | Rooms and shareable links | room isolation tests | – |
| 7 | Step 7 | Late joiners (in-memory store) | store + state tests | – |
| 8 | Step 8 | MongoDB persistence | store with adapters | – |
| 9 | Step 9 | Names and online users | presence tests | – |
| 10 | Step 10 | Live cursors | cursor tests | throttle |
| 11 | Step 11 | Hardening | validation tests | – |
| 12 | Step 12 | Deployment prep and README | – | – |

---

## 5. Phases in detail

For every phase: read the matching spec step first, implement its **Tasks**, then do everything listed here.

### Phase 0 — Project setup (spec Step 0)

**Implement**
- Root `package.json` (private) with scripts:
  - `"dev": "concurrently -n server,client -c blue,green \"npm run dev --prefix server\" \"npm run dev --prefix client\""`
  - `"install:all": "npm install && npm install --prefix server && npm install --prefix client"`
  - `"test": "npm test --prefix server && npm test --prefix client"`
- Root `.gitignore`: `node_modules/`, `.env`, `dist/`, `.DS_Store`, `*.log`.
- `client/` from the Vite React template, cleaned of starter content. Home page shows the heading "Whiteboard".
- `server/` with `src/index.js` serving `GET /health` → `{ ok: true }`, CORS restricted to `CLIENT_ORIGIN`, logs `Server listening on <port>`.
- `.env.example` files and real `.env` files (Section 2.2). Constants files (Section 2.1).
- `vitest` installed in both packages with `"test": "vitest run"`. Add one trivial passing test in each so the test command works from day one.
- `PROGRESS.md` with a title and an empty log.
- `git init` and the first commit.

**Automated checks**
- `npm run install:all` succeeds.
- Start the server briefly and `curl http://localhost:4000/health` returns `{"ok":true}`; then stop it.
- `npm run build --prefix client` succeeds.
- `npm test` at the root passes.
- `git status` shows no `.env` files.

**Do not:** add Socket.IO code, routing, or any UI beyond the heading.

---

### Phase 1 — Freehand pen (spec Step 1)

**Implement**
- `App.jsx` routes: `/` → `Home` (placeholder with a link to `/board/test123`), `/board/:boardId` → `Board`.
- `lib/geometry.js`: `getBoardPoint(event, canvas)` (spec Section 6) and `roundPoint([x, y])` (1 decimal).
- `lib/draw.js`: `drawElement(ctx, element)` and `redrawAll(ctx, elements)`. Every element is drawn inside `ctx.save()` / `ctx.restore()`. A single-point stroke draws a dot (filled circle of diameter `size`).
- `Canvas.jsx`: canvas with `width={BOARD_WIDTH} height={BOARD_HEIGHT}`, pointer events with `setPointerCapture`, incremental segment drawing during the stroke, elements stored in a `useRef`.
- Board page: canvas inside `.board-wrapper` with styles from spec Section 6 (white background on the wrapper, transparent canvas, `touch-action: none`).
- A temporary "Redraw (debug)" button that calls `redrawAll`. Keep it until Phase 3, then remove it.
- Element IDs: `"el_" + nanoid(10)`.

**Automated checks**
- `geometry.test.js`: `getBoardPoint` maps the center of a fake 800×450 rect to (800, 450), the top-left to (0, 0), and handles a rect with a non-zero `left`/`top` offset. Use plain objects to fake the event and canvas (`getBoundingClientRect`, `width`, `height`).
- `npm run build --prefix client` succeeds.

**Do not:** add color/size controls yet (hardcode `#1e1e1e` and `4`).

---

### Phase 2 — Color, size, eraser, clear (spec Step 2)

**Implement**
- `Toolbar.jsx` with Pen/Eraser buttons, color input + 8 preset swatches, size slider (`MIN_SIZE`–`MAX_SIZE`) with the value shown, Clear button. Use `<button>` elements with `aria-pressed` for tools and `title` tooltips.
- `tool`, `color`, `size` state in `Board.jsx`.
- Eraser via `globalCompositeOperation = "destination-out"` inside save/restore.
- Clear with `window.confirm`.
- Canvas CSS cursor depends on tool.
- Toolbar layout: a horizontal bar above the board that wraps on narrow screens.

**Automated checks**
- Build passes; existing tests pass.

---

### Phase 3 — Shapes (spec Step 3)

**Implement**
- Add Rectangle, Circle, Line tools.
- Second, stacked **preview canvas** that receives pointer events. The main canvas gets `pointer-events: none`.
- Pure helper functions in `lib/geometry.js`, used by both preview and final element creation:
  - `makeRect(start, end)` → `{ x, y, width, height }` (normalized, positive)
  - `makeCircle(start, end)` → `{ cx, cy, r }`
  - `makeLine(start, end)` → `{ x1, y1, x2, y2 }`
  - `isTooSmall(type, geom)` → true when the shape is below 3 units in its relevant dimensions
- `drawElement` supports `rect`, `circle`, `line` (outlines only).
- Remove the debug redraw button.

**Automated checks**
- Extend `geometry.test.js`: `makeRect` normalizes all four drag directions; `makeCircle` radius uses `Math.hypot`; `isTooSmall` rejects a click and accepts a real drag.
- Build passes.

**After this phase,** remind the user in the report that the single-user whiteboard is complete (spec milestone).

---

### Phase 4 — Socket.IO connection (spec Step 4)

**Implement**
- Split the server into `app.js` (`createServer`) and `index.js` (startup), as in Section 3.1. Socket.IO attached to the HTTP server with CORS for `CLIENT_ORIGIN`.
- Log connect/disconnect with socket ID and reason.
- `client/src/lib/socket.js`: one shared socket, `autoConnect: false`. Board page connects on mount and disconnects on unmount.
- `StatusBadge.jsx`: "Connected" (green) / "Disconnected — reconnecting…" (red). Initial state reads `socket.connected`.
- Every `socket.on` in a `useEffect` has a matching `socket.off` in cleanup. Must behave correctly under React Strict Mode.
- Create `server/src/__tests__/helpers.js` with `startTestServer()` (listens on port 0, returns `{ url, io, close }`) and `waitFor(socket, event, timeoutMs = 1000)`.

**Automated checks**
- `sockets.test.js`: a client can connect to the test server and receives `connect`; the server sees the connection.
- Tests close every client and the server in `afterEach`, so Vitest exits cleanly.

---

### Phase 5 — Live sync on one shared board (spec Step 5)

**Implement**
- Create `sockets/boardHandlers.js` with `registerBoardHandlers(io, socket, deps)`, called from `app.js` for each connection.
- `element:add` → `socket.broadcast.emit("element:added", { element })`.
- `board:clear` → `socket.broadcast.emit("board:cleared", { by: "Someone" })` (names come in Phase 9).
- Client: emit `element:add` on pointer up after drawing locally; on `element:added`, push and `drawElement`; on `board:cleared`, clear and show a short toast "Board was cleared" for 3 seconds.
- Keep remote drawing on the main canvas only; never touch the preview canvas or the in-progress stroke.

**Automated checks** (in `sockets.test.js`)
- With clients A and B: A emits `element:add`, B receives `element:added` with the same element; A does **not** receive it.
- A emits `board:clear`, B receives `board:cleared`.

**Note for the report:** tell the user the expected limitation (late joiners see an empty board) is intentional until Phase 7.

---

### Phase 6 — Rooms and shareable links (spec Step 6)

**Implement**
- `Home.jsx`: "Create new board" (navigates to `/board/<nanoid(10)>`) and a "Join board" form accepting an ID or full URL (extract the last path segment). Show an inline error for invalid input using `BOARD_ID_REGEX`.
- Board page: emit `board:join` with `{ boardId }` on every `connect` event (not just mount), so reconnects re-join automatically. Also re-join when `boardId` changes without remounting.
- Server: `board:join` validates the ID, leaves the previous room, joins the new one, sets `socket.data.boardId`. All broadcasts become `socket.to(socket.data.boardId).emit(...)`. Events from sockets without a board are ignored.
- Board header: board ID, "Copy link" button with "Link copied!" feedback, "Home" link, status badge.
- Show a friendly full-page message on `error:message` for an invalid board ID, with a link home.

**Automated checks**
- A and B on board X, C on board Y: A's element reaches B but not C; C's clear does not reach A or B.
- Invalid board ID → joiner receives `error:message`.
- A socket that switches from X to Y no longer receives X's events.
- An `element:add` from a socket that never joined is not broadcast to anyone.

---

### Phase 7 — Late joiners, in-memory store (spec Step 7)

**Implement**
- `persistence/memoryPersistence.js` implementing `load`, `append`, `clear` (Section 3.1).
- `boardStore.js`: `createBoardStore(persistence)` returning `{ getElements, addElement, clearBoard, evict }` with an in-memory `Map` cache in front of persistence. Store before broadcasting.
- `board:join` sends `board:state` to the joiner only.
- Client: a `loading` state ("Loading board…" overlay); drawing is disabled until the first `board:state`. On `board:state`, replace elements and `redrawAll`. Each reconnect triggers a fresh `board:state`, which must also replace (not append to) local elements.

**Automated checks**
- `boardStore.test.js`: add then get returns elements in order; clear empties; boards are independent.
- `sockets.test.js`: A draws two elements; B joins later and receives `board:state` with both, in order. After A clears, a new joiner receives an empty list.

---

### Phase 8 — MongoDB persistence (spec Step 8)

**Implement**
- `db.js`: `connectDB(uri)` with Mongoose; log success; on failure log a clear message and exit with code 1.
- `models/Board.js` per spec Section 4.2 (`boardId` unique + indexed, `elements: [Schema.Types.Mixed]`, timestamps).
- `persistence/mongoPersistence.js`:
  - `load` → `Board.findOne({ boardId }).lean()` → `elements` or `[]`
  - `append` → `updateOne({ boardId }, { $push: { elements: element } }, { upsert: true })`
  - `clear` → `updateOne({ boardId }, { $set: { elements: [] } }, { upsert: true })`
- `index.js` connects to MongoDB **before** listening and passes the Mongo-backed store to `createServer`. Tests keep using memory persistence.
- Handlers are `async` with `try/catch`; a failed load sends `error:message` ("Could not load board, please try again") and does not crash. A failed append is logged; the element is still broadcast (the in-memory cache has it).
- When the last socket leaves a room (on disconnect or board switch), call `store.evict(boardId)`.
- Fail fast when MongoDB is unreachable: set `serverSelectionTimeoutMS: 5000` on connect and `mongoose.set("bufferTimeoutMS", 5000)`, so a stopped database produces "Could not load board" within ~5 s instead of hanging ~10 s.
- README note (start a short README now): how to run MongoDB locally or use Atlas.

**Automated checks**
- `boardStore.test.js`: with a fake persistence adapter (spies), `getElements` loads from persistence only once (cache hit after), `addElement` calls `append`, `clearBoard` calls `clear`, and after `evict` the next `getElements` reloads.
- A store whose persistence `load` throws → the socket test receives `error:message` and the server keeps working for other boards.
- If MongoDB is available locally, start the real server and confirm it connects; if not, say so in the report and leave this as a manual check for the user.

---

### Phase 9 — Names and online users (spec Step 9)

**Implement**
- `lib/user.js`: `getUser()`, `setName(name)`. Generates `userId` (`"u_" + nanoid(8)`) and a random color from a 10-color palette on first use; persists in `localStorage` under the key `whiteboard:user`. Wrap `localStorage` access in try/catch.
- `NamePrompt.jsx`: modal shown before joining when no name exists; trimmed, 1–`MAX_NAME_LENGTH` chars, inline error when empty. Also reachable by clicking your own name to rename (rename re-emits `board:join`).
- `board:join` payload now includes `user`.
- `presence.js`: `createPresence()` returning `{ addUser, removeUser, listUsers, getUser }` over `Map<boardId, Map<socketId, user>>`.
- Server sanitizes the user (trim, max length, fallback "Guest", color regex with fallback).
- Broadcast `presence:update` with `io.to(boardId)` on join, leave, board switch, and disconnect.
- `board:cleared` now includes the real name: toast "Board cleared by <name>".
- `OnlineUsers.jsx`: count + list with colored dots, "(you)" for `socket.id`. Placed beside the board on wide screens, below it on narrow screens.

**Automated checks**
- `presence.test.js`: add/remove/list per board; boards independent; removing the last user removes the board entry.
- `sockets.test.js`: A and B join → both receive a `presence:update` with two users; B disconnects → A receives one with one user. A user from board Y never appears in X's list. Invalid name/color is sanitized.

---

### Phase 10 — Live cursors (spec Step 10)

**Implement**
- `lib/throttle.js`: hand-written `throttle(fn, ms)` with a trailing call (so the last position is always sent), plus a `cancel()` method. Add a comment explaining how it works.
- Pointer move on the board wrapper → throttled `cursor:move` with board coordinates; `pointerleave` → `cursor:leave`.
- Server: `cursor:move` validates numbers and uses `socket.volatile.to(boardId).emit("cursor:moved", {...})` with name/color from presence; `cursor:leave`, disconnect, **and switching boards** (sent to the old room) emit `cursor:left`. Ignore cursor events from sockets without a board or without presence.
- `CursorLayer.jsx`: absolutely positioned cursors using percentages, `pointer-events: none`, CSS transition, arrow drawn with inline SVG in the user's color plus a name label. Remove cursors idle for 10 seconds (one interval timer, cleared on unmount). Clear all cursors on `board:state` (e.g., after a reconnect).

**Automated checks**
- `throttle.test.js` with fake timers: many calls in 50 ms run the function at most twice (leading + trailing); the trailing call uses the latest arguments; `cancel()` prevents the trailing call.
- `sockets.test.js`: A's `cursor:move` reaches B with A's name and color, not A; `cursor:leave` and A disconnecting produce `cursor:left` at B.

---

### Phase 11 — Hardening (spec Step 11)

**Implement**
- `validate.js`: `isValidBoardId`, `sanitizeUser`, `isValidPoint`, `isValidElement` per spec Step 11 (types, id string ≤ 40 chars, finite numbers, bounds −100…1700 / −100…1000, size range, hex color, 1…`MAX_POINTS_PER_STROKE` points, eraser strokes may omit or ignore color). Reject unknown extra fields by building a **clean copy** of the element with only allowed fields and storing that copy.
- Enforce `MAX_ELEMENTS_PER_BOARD` (send `error:message` "Board is full").
- Socket.IO `maxHttpBufferSize: 1e6`.
- Client: dedupe incoming elements by `id`; show `error:message` text as a toast.
- Pointer robustness: track the active `pointerId`; ignore other pointers while drawing; treat `pointercancel` like `pointerup`.
- Keyboard shortcuts P/E/R/C/L, ignored when focus is in an input, textarea, or the name modal.
- **Client-side outbox (required).** Socket.IO's built-in send buffer is flushed *before* the `connect` event fires, so buffered `element:add` messages would reach the server before the re-`board:join` and be ignored (the new socket has no `socket.data.boardId`). Therefore: while disconnected (or before the first `board:state` after a (re)join), queue `element:add` in a client outbox instead of emitting; after receiving `board:state`, merge queued elements into the local list and flush the outbox in order. Explain this in the report.
- Server logging: `[board <id>] join <name>`, `leave`, `rejected element: <reason>`.
- In development only (`import.meta.env.DEV`), expose `window.__socket` so the user can run the spec's console tests.

**Automated checks**
- `validate.test.js`: valid examples of all four types pass; invalid type, NaN, Infinity, out-of-range coordinates, oversized stroke, bad color, size 0 and 41, missing fields all fail; extra fields are stripped.
- `sockets.test.js`: invalid element → sender gets `error:message`, others receive nothing, store unchanged; board-full limit (use a small limit injected through `createServer` options for the test).

---

### Phase 12 — Deployment prep and README (spec Step 12)

Claude Code prepares everything; the **user** performs the actual deployment (accounts and secrets are theirs).

**Implement**
- `client/vercel.json` with the SPA rewrite **and** `client/public/_redirects` for Netlify (both, so the user can choose).
- Server reads `PORT` from the environment; `CLIENT_ORIGIN` may be a comma-separated list (split into an array for CORS).
- Server `package.json` has `"start": "node src/index.js"`. Add `"engines": { "node": ">=20" }`.
- `npm run dev:lan` script for the client (`vite --host`) for the local-network demo.
- Full `README.md`: project description, feature list, architecture diagram (copy from spec Section 3), prerequisites, setup (`npm run install:all`, `.env` files, MongoDB), running (`npm run dev`), testing (`npm test`), the event protocol table (link to spec), deployment walkthrough (MongoDB Atlas → Render/Railway → Vercel/Netlify, with the env vars each needs), LAN demo steps, and known limitations (copy from spec Section 9).

**Automated checks**
- `npm test` at the root passes; `npm run build --prefix client` passes.
- Start the server with `NODE_ENV=production` and the built client served by `vite preview`; confirm `/health` responds.
- Re-read the spec's Section 8 (final acceptance test) and list in the report any line you could not verify automatically, so the user can run it by hand.

---

## 6. Reporting

### 6.1 End-of-phase report (send to the user in chat)

```
## Phase N complete: <title>

**What I built**
- <3–6 bullets in plain language>

**Files added / changed**
- <path> — <one line>

**Automated checks**
- client build: pass / fail
- tests: <X passed, Y failed>
- <any other checks>

**Please verify manually** (spec Step N checklist)
1. <the most important 3–6 checks, with exact steps: which URL, how many tabs, what to click>

**Concepts to understand from this phase**
- <2–3 short explanations: e.g. why setPointerCapture, why socket.to vs io.to>

**Notes / deviations from the spec**
- <anything that differs and why, or "None">

Reply "Phase N verified, continue" to start Phase N+1.
```

### 6.2 PROGRESS.md entry

```
## Phase N — <title> (<date>)
- Status: done, awaiting manual verification
- Commit: <short hash>
- Tests: <counts>
- Notes: <deviations, known issues>
```

---

## 7. Definition of done (whole project)

- [ ] All 13 phases committed, each with a PROGRESS.md entry.
- [ ] `npm run install:all && npm test` passes on a fresh clone.
- [ ] `npm run dev` starts both apps with one command.
- [ ] Every item in spec Section 8 (final acceptance test) passes manually.
- [ ] No console errors or React warnings during normal use.
- [ ] No out-of-scope features were added.
- [ ] README is complete enough that a classmate could run the project from scratch.

---

## 8. Troubleshooting guide for Claude Code

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Events received twice | Listener registered twice (Strict Mode, missing `socket.off`) | Pair every `on` with `off` in cleanup; register handlers with stable function references |
| Sender sees its own element twice | Used `io.to(room)` instead of `socket.to(room)` | Use `socket.to` for everything except `presence:update` |
| Lines offset from pointer | Using `clientX/Y` directly | Use `getBoardPoint` |
| Erased areas black | Canvas has a background or composite op not restored | Transparent canvas, white wrapper, `save/restore` per element |
| User missing from online list after reconnect | Join emitted only on mount | Emit `board:join` inside the `connect` handler |
| Vitest hangs after socket tests | Clients/server not closed | Close all clients and `io.close()` in `afterEach` |
| 404 when refreshing `/board/...` in production | Missing SPA rewrite | `vercel.json` / `_redirects` |
| CORS error | `CLIENT_ORIGIN` mismatch (port, trailing slash, http vs https) | Match the exact origin |

---

## 9. Kickoff prompt (copy this into Claude Code)

```
You are building a real-time collaborative whiteboard for my coursework.
Read plan.md fully, then read spec.md fully. plan.md tells you how to work;
spec.md defines the features, data model, events and checklists.

Implement Phase 0 only. Follow every rule in plan.md Section 1.
When done, give me the end-of-phase report (plan.md Section 6.1) and stop.
If anything in the documents is unclear or contradictory, ask me before coding.
```
