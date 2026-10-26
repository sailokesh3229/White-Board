# Real-Time Collaborative Whiteboard — Project Specification

> **Approved accounts/Azure follow-up:** Require an account to edit workspaces or access uploaded images. Provide sign-up, sign-in, and sign-out with expiring sessions, and host the client and server on a single Azure origin using the F1 Free tier. Existing workspace URLs remain shareable among signed-in users. Azure sign-in and a remote Atlas URI are prerequisites for actual deployment.

> **Approved v2 upgrade (2026-10-26):** The user approved a submission-focused studio redesign, editable text and notes, persistent image annotation, object manipulation, undo/redo, touch writing, zoom, up to 20 slide-like pages, presentation and export. These supersede the v1 out-of-scope list below. Existing boards must remain readable. Page switching autosaves; deleting a page requires confirmation. No accounts, paid AI services, or new external upload service are required for this release.

> A step-by-step build and verification guide. Every step ends with a **working, testable app** and a checklist you can tick off before moving on. Do not start a step until every box in the previous step is checked.

---

## 1. Project overview

A browser-based whiteboard where multiple people can draw together in real time. Each board lives at its own URL (for example `/board/abc123`), so sharing the link is all it takes to invite someone. Drawings are saved, so a board looks the same when anyone comes back to it.

### 1.1 In scope (this version)

| # | Feature | Description |
|---|---------|-------------|
| F1 | Freehand drawing | Draw smooth strokes with mouse, trackpad, pen, or touch |
| F2 | Color & brush size | Pick a stroke color and a brush thickness |
| F3 | Eraser | Erase parts of the drawing by painting over them |
| F4 | Clear board | Wipe the whole board for everyone (with confirmation) |
| F5 | Shapes | Rectangle, circle, and straight line, with a live preview while dragging |
| F6 | Shareable rooms | Each board has a unique URL; boards are isolated from each other |
| F7 | Live sync | Changes appear for everyone on the same board almost instantly |
| F8 | Persistence | Boards are saved to a database and reload on rejoin, even after a server restart |
| F9 | Live cursors | See other users' pointers moving, labeled with their names |
| F10 | Online users | A list of who is currently on the board |

### 1.2 Out of scope (planned for later)

- Undo / redo (the data model below is designed so this is easy to add later)
- Export to PNG / PDF
- User accounts, login, and permissions
- Selecting, moving, or resizing existing elements
- Text tool, sticky notes, images
- Zoom and pan (infinite canvas)

---

## 2. Key decisions and assumptions

These are the defaults this spec uses. You can change them, but update the spec if you do.

| Decision | Choice | Why |
|----------|--------|-----|
| Frontend | React + Vite | Fast dev server, common in coursework |
| Drawing | Plain HTML `<canvas>` 2D API (no drawing library) | You learn how drawing actually works |
| Routing | `react-router-dom` | Needed for `/board/:boardId` URLs |
| Backend | Node.js + Express + Socket.IO | Socket.IO handles rooms, reconnection, and fallbacks for you |
| Database | MongoDB with Mongoose (local install or free MongoDB Atlas) | Elements are JSON-like, which fits a document database |
| Board IDs | Random 10-character IDs generated with `nanoid` | Hard to guess, URL-safe |
| Identity | No login. Users type a display name once; it is saved in `localStorage` | Keeps the focus on real-time features |
| Board size | Fixed logical size of **1600 × 900** units, scaled to fit the screen | Everyone sees the same drawing in the same place, regardless of screen size |
| Eraser type | "Pixel eraser" (paints transparency over anything underneath) | Simple and feels natural |
| Conflict policy | Elements are only ever **added** (never edited), so the server simply stores them in the order it receives them | Avoids complex conflict resolution |

---

## 3. Architecture

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

**The golden rule of this app:** the client draws its own changes immediately (so it feels instant), then tells the server. The server stores the change and forwards it to everyone *else* in the room. Each client draws what it receives.

### 3.1 Folder structure

```
whiteboard/
├── spec.md
├── client/                         # React app (Vite)
│   ├── index.html
│   ├── .env                        # VITE_SERVER_URL=http://localhost:4000
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                 # routes: "/" and "/board/:boardId"
│       ├── pages/
│       │   ├── Home.jsx            # create / join a board
│       │   └── Board.jsx           # the whiteboard screen
│       ├── components/
│       │   ├── Canvas.jsx          # main canvas + preview canvas + pointer handling
│       │   ├── Toolbar.jsx         # tools, color, size, clear
│       │   ├── CursorLayer.jsx     # other users' cursors
│       │   ├── OnlineUsers.jsx     # who's online
│       │   └── NamePrompt.jsx      # asks for display name once
│       └── lib/
│           ├── socket.js           # single shared Socket.IO client
│           ├── draw.js             # drawElement(), redrawAll()
│           ├── geometry.js         # getBoardPoint(), shape math
│           └── user.js             # load/save name, color, userId
└── server/
    ├── package.json
    ├── .env                        # PORT, MONGODB_URI, CLIENT_ORIGIN
    └── src/
        ├── index.js                # Express + Socket.IO setup
        ├── db.js                   # Mongo connection
        ├── models/Board.js         # Mongoose schema
        ├── boardStore.js           # in-memory cache + DB read/write
        ├── presence.js             # who is in which room
        ├── validate.js             # checks incoming data
        └── sockets/boardHandlers.js
```

---

## 4. Data model

### 4.1 Elements

Everything drawn on the board is an **element**: a plain JSON object. The board is an **ordered array of elements**. To draw the board, you clear the canvas and draw each element in order.

All elements share these fields:

```js
{
  id: "el_V1StGXR8_Z",      // unique, generated by the client with nanoid
  type: "stroke",           // "stroke" | "rect" | "circle" | "line"
  color: "#1e1e1e",         // hex color
  size: 4,                  // line width, 1–40
  createdBy: "u_8f3k...",   // userId (useful later for undo)
  createdAt: 1730000000000  // Date.now()
}
```

Type-specific fields:

| Type | Extra fields | Notes |
|------|--------------|-------|
| `stroke` | `tool: "pen" \| "eraser"`, `points: [[x, y], ...]` | Eraser strokes ignore `color` |
| `rect` | `x, y, width, height` | Normalize so `width` and `height` are always positive |
| `circle` | `cx, cy, r` | Drag from center outward; `r` = distance from start to current point |
| `line` | `x1, y1, x2, y2` | Straight line from drag start to drag end |

All coordinates are in **board units** (0–1600 horizontally, 0–900 vertically), never screen pixels. Round coordinates to 1 decimal place to keep messages small.

### 4.2 Board document (MongoDB)

```js
{
  boardId: "abc123XYZ0",   // unique index
  elements: [ /* elements in order */ ],
  createdAt: Date,
  updatedAt: Date
}
```

### 4.3 User (client-side only, stored in localStorage)

```js
{ userId: "u_8f3k...", name: "Priya", color: "#e8590c" }
```

The color is picked at random from a fixed palette of 8–10 distinct colors the first time the user visits. It is used for their cursor and their dot in the online list (not their drawing color).

### 4.4 Presence (server memory only, never saved)

```js
// Map<boardId, Map<socketId, { userId, name, color }>>
```

Presence lives only in memory because it only matters while people are connected.

---

## 5. Real-time event protocol

After a socket joins a board, the server remembers it in `socket.data.boardId`. That is why later events do not need to include the `boardId`, and it also stops a client from sending events to a board it has not joined.

### 5.1 Client → Server

| Event | Payload | When |
|-------|---------|------|
| `board:join` | `{ boardId, user: { userId, name, color } }` | When the board page opens, and again after any reconnect |
| `element:add` | `{ element }` | When a stroke or shape is finished (pointer up) |
| `board:clear` | *(none)* | After the user confirms "Clear board" |
| `cursor:move` | `{ x, y }` | Pointer moves over the board (throttled to every 50 ms) |
| `cursor:leave` | *(none)* | Pointer leaves the board area |

### 5.2 Server → Client

| Event | Payload | Sent to |
|-------|---------|---------|
| `board:state` | `{ elements }` | Only the user who just joined |
| `element:added` | `{ element }` | Everyone in the room **except** the sender |
| `board:cleared` | `{ by: name }` | Everyone in the room **except** the sender |
| `presence:update` | `{ users: [{ socketId, name, color }] }` | **Everyone** in the room, including the sender |
| `cursor:moved` | `{ socketId, name, color, x, y }` | Everyone in the room except the sender |
| `cursor:left` | `{ socketId }` | Everyone in the room except the sender |
| `error:message` | `{ message }` | Only the sender, when it sent invalid data |

### 5.3 Socket.IO targeting cheat sheet

| Code | Who receives it |
|------|-----------------|
| `socket.emit(...)` | Only this one client |
| `socket.to(room).emit(...)` | Everyone in the room except this client |
| `io.to(room).emit(...)` | Everyone in the room, including this client |
| `socket.volatile.to(room).emit(...)` | Same as above, but may be dropped if the network is busy (perfect for cursors) |

---

## 6. Coordinate system (read before Step 1)

The `<canvas>` element always has `width="1600"` and `height="900"` as attributes (its internal resolution), but CSS stretches it to fit the screen. So a mouse position in screen pixels must be converted into board units:

```js
// lib/geometry.js
export function getBoardPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}
```

Because every user stores and sends board units, a point drawn at `(800, 450)` lands in the center of the board on a phone and on a 4K monitor alike. Cursors use the same trick in reverse: position them with `left: (x / 1600) * 100%` and `top: (y / 900) * 100%`.

CSS for the board container:

```css
.board-wrapper { position: relative; width: 100%; max-width: 1600px; aspect-ratio: 16 / 9; }
.board-wrapper canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
```

`touch-action: none` stops the page from scrolling when someone draws with a finger on a phone.

---
## 7. Build plan overview

| Step | Name | Result you can demo |
|------|------|---------------------|
| 0 | Project setup | Client and server both run |
| 1 | Freehand pen (single user) | You can draw on the canvas |
| 2 | Color, size, eraser, clear | A full single-user sketch pad |
| 3 | Shapes | Rectangle, circle, and line with live preview |
| 4 | Socket.IO connection | Client shows "Connected" |
| 5 | Live sync (one shared board) | Two tabs draw together |
| 6 | Rooms and shareable links | Different URLs = different boards |
| 7 | Late joiners get the board | New tabs see existing drawings |
| 8 | MongoDB persistence | Boards survive a server restart |
| 9 | Names and online users list | See who is on the board |
| 10 | Live cursors | See other people's pointers move |
| 11 | Hardening and edge cases | App stays stable under bad input and reconnects |
| 12 | Deployment and demo | A public link you can show anyone |

Each step below has: **Goal**, **What you will learn**, **Tasks**, **Verification checklist**, and **Common problems**.

> Tip: make a Git commit at the end of every step, for example `git commit -m "Step 5: live sync working"`. If something breaks later, you can always go back.

---

## Step 0 — Project setup

**Goal:** Both apps start, and the server answers a health check.

**What you will learn:** Project structure, npm scripts, environment variables, CORS.

### Tasks

1. Install Node.js 20 or newer and Git. Create the `whiteboard/` folder and run `git init`.
2. Create the client: `npm create vite@latest client -- --template react`, then inside `client/` run `npm install react-router-dom socket.io-client nanoid`.
3. Create the server: `mkdir server && cd server && npm init -y`, then `npm install express socket.io cors dotenv mongoose nanoid` and `npm install -D nodemon`.
4. In `server/package.json` set `"type": "module"` and add a script `"dev": "nodemon src/index.js"`.
5. In `server/src/index.js`, create an Express app with CORS allowing `http://localhost:5173`, and add `GET /health` returning `{ ok: true }`. Listen on port `4000` (read from `.env`).
6. Create `server/.env` with `PORT=4000` and `CLIENT_ORIGIN=http://localhost:5173`. Add `.env` and `node_modules` to `.gitignore`.
7. Replace the Vite starter page with a simple heading "Whiteboard".

### Verification checklist

- [ ] `node -v` prints v20 or higher.
- [ ] `npm run dev` in `client/` opens http://localhost:5173 and shows "Whiteboard".
- [ ] `npm run dev` in `server/` prints something like "Server listening on 4000".
- [ ] Visiting http://localhost:4000/health shows `{"ok":true}`.
- [ ] Editing and saving a server file makes nodemon restart automatically.
- [ ] `.env` does not appear in `git status`.

### Common problems

- *"Cannot use import statement outside a module"*: you forgot `"type": "module"` in `server/package.json`.
- *Port already in use*: another process is using 4000 or 5173. Stop it or change the port.

---

## Step 1 — Freehand pen (single user, no server)

**Goal:** Draw smooth black lines with the mouse, trackpad, or finger.

**What you will learn:** Canvas 2D API, pointer events, converting screen coordinates to board coordinates, React refs.

### Tasks

1. Set up routes in `App.jsx`: `/` shows a placeholder home page, `/board/:boardId` shows `Board.jsx`. For now, just visit `/board/test`.
2. In `Canvas.jsx`, render a `<canvas width={1600} height={900}>` inside `.board-wrapper` (see Section 6). Give the wrapper a white background and a light border.
3. Get the 2D context with a `useRef`. Set `ctx.lineCap = "round"` and `ctx.lineJoin = "round"` so lines look smooth.
4. Use **pointer events** (`onPointerDown`, `onPointerMove`, `onPointerUp`), not mouse events, so that touch and stylus work too. Call `canvas.setPointerCapture(e.pointerId)` on pointer down so drawing continues even if the pointer leaves the canvas.
5. On pointer down, start a new stroke element: `{ id, type: "stroke", tool: "pen", color: "#1e1e1e", size: 4, points: [[x, y]] }`.
6. On pointer move (only while drawing), add the point and draw just the newest segment (from the previous point to the new point) directly on the canvas. Do not redraw everything on every move; that gets slow.
7. On pointer up, push the finished stroke into an `elements` array kept in a `useRef` (not state; you don't want React re-rendering on every point).
8. Write `drawElement(ctx, element)` in `lib/draw.js` that draws a complete stroke from its points, and `redrawAll(ctx, elements)` that clears the canvas and draws every element in order. You will use these constantly from now on.

### Verification checklist

- [ ] Moving the mouse without pressing does not draw.
- [ ] Press, drag, and release draws a smooth line that follows the pointer exactly (no offset).
- [ ] Line ends and corners are rounded, not jagged.
- [ ] Resize the browser window: the drawing scales with the canvas and the pointer still lines up perfectly after resizing.
- [ ] Dragging off the edge of the canvas and back does not leave a straight "jump" line.
- [ ] A single click (no drag) leaves a small dot (draw a tiny segment or circle for single-point strokes).
- [ ] In DevTools device mode (or on a phone), drawing with touch works and the page does not scroll.
- [ ] Temporary test: add a button that calls `redrawAll()`. Clicking it redraws exactly the same picture. This proves your saved element data is correct.

### Common problems

- *Lines are offset from the pointer*: you are using raw `clientX/Y` instead of `getBoardPoint()`.
- *Lines are blurry*: the canvas `width`/`height` attributes are missing, so the canvas is 300×150 being stretched.

---

## Step 2 — Color, brush size, eraser, and clear (still single user)

**Goal:** A complete single-user sketch pad.

**What you will learn:** Lifting state up in React, canvas compositing modes, separating UI state from drawing data.

### Tasks

1. Build `Toolbar.jsx` with: tool buttons (Pen, Eraser), a color input (`<input type="color">`) plus 6–8 preset color swatches, a size slider (1–40) with the current value shown, and a "Clear board" button.
2. Keep `tool`, `color`, and `size` as state in `Board.jsx` and pass them down to both `Toolbar` and `Canvas`.
3. New strokes use the current `color` and `size`.
4. **Eraser:** an eraser is just a stroke with `tool: "eraser"`. In `drawElement`, when the tool is eraser, set `ctx.globalCompositeOperation = "destination-out"` before drawing and reset it to `"source-over"` afterward. This makes the eraser cut transparent holes, and the white background of the wrapper shows through.
5. **Clear:** show `window.confirm("Clear the whole board?")`. If confirmed, empty the elements array and clear the canvas.
6. Highlight the active tool button so the user always knows what is selected.
7. Change the canvas cursor style depending on tool (for example `crosshair` for pen, `cell` for eraser).

### Verification checklist

- [ ] Choosing a new color only affects new strokes; old strokes keep their color.
- [ ] Size 1 draws a hairline, size 40 draws a thick marker line.
- [ ] The eraser removes parts of any stroke it passes over, and the background looks white (not black or grey) where you erased.
- [ ] Draw over an erased area with the pen: the new stroke appears normally (eraser does not affect later strokes).
- [ ] Click your temporary redraw button: the picture, including erased gaps, looks identical.
- [ ] Clear asks for confirmation; Cancel keeps the drawing, OK wipes it.
- [ ] The active tool is visibly highlighted.

### Common problems

- *Erased areas turn black*: the canvas itself has a CSS background or you are drawing in black. The canvas must be transparent; put the white background on the wrapper.
- *After erasing, the pen stops working*: you forgot to reset `globalCompositeOperation` to `"source-over"`. Use `ctx.save()` and `ctx.restore()` around each element to be safe.

---

## Step 3 — Shapes: rectangle, circle, line

**Goal:** Draw shapes by dragging, with a live preview.

**What you will learn:** Using two stacked canvases, shape geometry, normalizing coordinates.

### Tasks

1. Add Rectangle, Circle, and Line buttons to the toolbar.
2. Add a second **preview canvas** on top of the main canvas (same size, same position). It only shows the shape being dragged right now. Pointer events go to the top (preview) canvas.
3. On pointer down with a shape tool, remember the start point.
4. On pointer move, clear the preview canvas and draw the shape from the start point to the current point.
   - Rectangle: `x = min(x1, x2)`, `y = min(y1, y2)`, `width = |x2 − x1|`, `height = |y2 − y1|`.
   - Circle: center is the start point, `r = Math.hypot(x2 − x1, y2 − y1)`.
   - Line: from start to current point.
5. On pointer up, clear the preview, build the final element (Section 4.1), draw it on the main canvas, and add it to `elements`.
6. Ignore tiny shapes (for example width and height both under 3 units) so accidental clicks don't create invisible elements.
7. Extend `drawElement` to handle `rect`, `circle`, and `line`. Shapes are outlines only (no fill) using the current color and size.

### Verification checklist

- [ ] Dragging shows a preview that follows the pointer smoothly, with no "trail" of old previews.
- [ ] Rectangles work when dragging in all four directions (including up-left), and are never inverted.
- [ ] Circles grow from the point where you started dragging.
- [ ] Lines go exactly from start to end point.
- [ ] Shapes use the selected color and thickness.
- [ ] A click without dragging does not create a shape.
- [ ] The eraser can erase parts of shapes.
- [ ] The redraw button reproduces shapes exactly.

**Milestone:** You now have a complete single-user whiteboard. Commit it. Everything from here adds the "real-time" part.

---

## Step 4 — Socket.IO connection

**Goal:** The client connects to the server and shows its connection status.

**What you will learn:** What a WebSocket connection is, connect and disconnect events, automatic reconnection.

### Tasks

1. On the server, wrap Express in an `http` server and attach Socket.IO with CORS set to `CLIENT_ORIGIN`.
2. Log `connected <socket.id>` on connection and `disconnected <socket.id> <reason>` on disconnect.
3. In `client/src/lib/socket.js`, create **one** shared socket with `io(import.meta.env.VITE_SERVER_URL, { autoConnect: false })`. Export it and connect it when the board page mounts.
4. In `Board.jsx`, listen for `connect` and `disconnect` and show a small status badge: green "Connected" or red "Disconnected — reconnecting…".
5. Always remove listeners in the `useEffect` cleanup (`socket.off("event", handler)`), otherwise you will get duplicate handlers.

### Verification checklist

- [ ] Opening the board page prints `connected <id>` in the server terminal.
- [ ] Each new tab prints a new, different ID.
- [ ] Closing a tab prints `disconnected` with a reason like `transport close`.
- [ ] Stop the server: the badge turns red within a few seconds. Start it again: the badge turns green on its own without refreshing.
- [ ] In DevTools → Network → WS, you can see the WebSocket connection and its messages.
- [ ] In React Strict Mode (development), the server does not show two connections per tab that never close. If it does, check your cleanup.

---

## Step 5 — Live sync between users (one shared board)

**Goal:** Two browser tabs draw together. For now, everyone shares one global board.

**What you will learn:** Broadcasting, the "draw locally first, then send" pattern, drawing remote updates.

### Tasks

1. Client: on pointer up (stroke or shape finished), after drawing locally, `socket.emit("element:add", { element })`.
2. Server: on `element:add`, broadcast to others with `socket.broadcast.emit("element:added", { element })`.
3. Client: on `element:added`, push the element into `elements` and call `drawElement()` on the main canvas.
4. Clear: after confirming, clear locally and emit `board:clear`. The server broadcasts `board:cleared`. Other clients clear their canvas and elements and can show a short message like "Board was cleared".
5. Make sure the remote drawing code does not touch the local in-progress stroke or preview canvas.

### Verification checklist

Open two tabs side by side (Tab A and Tab B).

- [ ] Draw in A: the stroke appears in B as soon as you release the pointer.
- [ ] Draw in B: it appears in A.
- [ ] Colors, sizes, eraser strokes, and all three shapes look the same in both tabs.
- [ ] Clear in A: B clears too.
- [ ] Open a third tab, C: all three stay in sync.
- [ ] In the WS tab of DevTools you can see `element:add` messages and their JSON payload.
- [ ] **Expected limitation:** a tab opened *after* drawing starts with an empty board. This is fixed in Step 7. Write down why this happens; it is a good point for your report.

### Common problems

- *Each stroke appears twice in the other tab*: you registered the listener twice (missing `socket.off` in cleanup).
- *The sender sees its own stroke drawn twice*: you used `io.emit` instead of `socket.broadcast.emit`.

---

## Step 6 — Rooms and shareable links

**Goal:** Every board has its own URL, and boards never affect each other.

**What you will learn:** Socket.IO rooms, URL parameters, isolating data between groups of users.

### Tasks

1. **Home page (`/`):** a "Create new board" button that generates an ID with `nanoid(10)` and navigates to `/board/<id>`, plus a "Join board" input that accepts either an ID or a full board URL.
2. **Board page:** read `boardId` with `useParams()`. After connecting, emit `board:join` with `{ boardId }` (the user object is added in Step 9).
3. **Server:** on `board:join`:
   - Validate the ID with `/^[A-Za-z0-9_-]{6,32}$/`. If invalid, emit `error:message` and stop.
   - If this socket was already in a different board, leave that room first.
   - `socket.join(boardId)` and store `socket.data.boardId = boardId`.
4. Change every broadcast from Step 5 to target the room: `socket.to(socket.data.boardId).emit(...)`. Ignore `element:add` and `board:clear` from sockets that have not joined a board.
5. Add a "Copy link" button that copies `window.location.href` with `navigator.clipboard.writeText()` and shows "Link copied!".
6. Show the board ID somewhere small on the board page, and a "Home" link.
7. Show a friendly message if the server reports an invalid board ID.

Server handler skeleton (fill in the rest yourself):

```js
socket.on("board:join", ({ boardId }) => {
  if (!isValidBoardId(boardId)) return socket.emit("error:message", { message: "Invalid board ID" });
  if (socket.data.boardId) socket.leave(socket.data.boardId);
  socket.join(boardId);
  socket.data.boardId = boardId;
});

socket.on("element:add", ({ element }) => {
  const boardId = socket.data.boardId;
  if (!boardId) return;
  socket.to(boardId).emit("element:added", { element });
});
```

### Verification checklist

- [ ] "Create new board" opens a new URL with a random ID each time.
- [ ] Two tabs on `/board/AAAAAA1111` sync with each other.
- [ ] A third tab on `/board/BBBBBB2222` does **not** receive their drawings, and its drawings do not reach them.
- [ ] Clear on one board does not clear the other board.
- [ ] Copy link, paste it into a new tab: it opens the same board and syncs.
- [ ] Pasting a full URL into "Join board" on the home page works, and so does pasting only the ID.
- [ ] Visiting `/board/a!` shows an "invalid board" message instead of a broken page.
- [ ] Navigating from one board to another in the same tab (without refreshing) leaves the first room. Check this by drawing on the first board from another tab and confirming nothing arrives.

---

## Step 7 — Late joiners receive the current board (in memory)

**Goal:** Anyone who opens a board sees everything already drawn on it.

**What you will learn:** Server as the "source of truth", sending initial state, in-memory caching and its limits.

### Tasks

1. In `server/src/boardStore.js`, keep `const boards = new Map(); // boardId -> elements[]`.
2. On `element:add`, append the element to that board's array **before** broadcasting it.
3. On `board:clear`, set that board's array to `[]`.
4. On `board:join`, after joining the room, send the current elements to the joiner only: `socket.emit("board:state", { elements })`.
5. Client: on `board:state`, replace the local `elements` array and call `redrawAll()`.
6. Show a short "Loading board…" state until the first `board:state` arrives, and disable drawing until then (otherwise a stroke drawn during loading would be wiped by the redraw).

### Verification checklist

- [ ] Draw several strokes and shapes in Tab A. Open Tab B on the same URL: everything is there.
- [ ] Refresh Tab A: the drawing comes back.
- [ ] Erased areas look the same after refresh (eraser strokes are replayed in order).
- [ ] After a clear, a newly opened tab shows an empty board.
- [ ] Boards still don't mix: a new tab on a different board ID is empty.
- [ ] **Expected limitation:** restart the server and refresh: the board is empty again, because memory is wiped on restart. Step 8 fixes this.

---

## Step 8 — Persistence with MongoDB

**Goal:** Boards survive server restarts and can be reopened days later.

**What you will learn:** Mongoose schemas, upserts, the `$push` operator, write-through caching, async error handling.

### Tasks

1. Set up MongoDB: either install it locally (`mongodb://127.0.0.1:27017/whiteboard`) or create a free MongoDB Atlas cluster. Put the connection string in `server/.env` as `MONGODB_URI`.
2. In `db.js`, connect with Mongoose when the server starts. Log success, and stop the server with a clear message if the connection fails.
3. In `models/Board.js`, define the schema from Section 4.2 with `boardId` as `{ type: String, unique: true, index: true }`, `elements` as an array of `Schema.Types.Mixed`, and `{ timestamps: true }`.
4. Update `boardStore.js` to use a **write-through cache**:
   - `getElements(boardId)`: if the board is in the memory `Map`, return it. Otherwise load it from MongoDB (or start with `[]` if it doesn't exist yet), store it in the `Map`, and return it.
   - `addElement(boardId, element)`: push into the `Map` and also run `Board.updateOne({ boardId }, { $push: { elements: element } }, { upsert: true })`.
   - `clearBoard(boardId)`: empty the `Map` entry and run `Board.updateOne({ boardId }, { $set: { elements: [] } }, { upsert: true })`.
5. Make `board:join` handlers `async` and wrap database calls in `try/catch`. If loading fails, send `error:message` instead of crashing.
6. (Optional) When the last person leaves a board, remove it from the memory `Map` to save memory. It will be reloaded from MongoDB next time.

### Verification checklist

- [ ] Draw on a board, stop the server, start it again, refresh: the drawing is still there.
- [ ] In MongoDB Compass (or Atlas "Browse Collections"), you can find the board document and read its elements as JSON.
- [ ] Clear the board: the document's `elements` becomes an empty array.
- [ ] A brand-new board ID creates a document only after the first element is drawn (or on clear).
- [ ] Draw quickly with many strokes in two tabs at once, then restart and refresh: the element count in the database matches what you see (no lost strokes).
- [ ] Stop MongoDB while the server is running and try to open a board: the server logs an error but does **not** crash, and the user sees a message.

---

## Step 9 — Display names and online users list

**Goal:** Each user has a name, and everyone sees who is on the board right now.

**What you will learn:** Presence tracking, handling disconnects, keeping server and client state in sync.

### Tasks

1. **Client identity (`lib/user.js`):** on first visit, generate `userId` (`"u_" + nanoid(8)`) and pick a random color from a palette, and save both in `localStorage`.
2. **Name prompt (`NamePrompt.jsx`):** if no name is saved, show a small modal on the board page asking "What's your name?" before joining. Trim it, require 1–20 characters, and save it. Add a way to change your name later (for example clicking your own name in the online list).
3. Send the user with the join: `board:join` → `{ boardId, user: { userId, name, color } }`.
4. **Server (`presence.js`):** keep `Map<boardId, Map<socketId, user>>`. Functions: `addUser(boardId, socketId, user)`, `removeUser(boardId, socketId)`, `listUsers(boardId)`.
5. On join, add the user and send `presence:update` to **everyone** in the room with `io.to(boardId).emit(...)`.
6. On `disconnect` (and when switching boards), remove the user and send `presence:update` to the remaining users.
7. **Client (`OnlineUsers.jsx`):** show a panel listing users with their colored dot and name, mark yourself with "(you)" by comparing `socketId` with `socket.id`, and show the count, for example "3 online".
8. Validate on the server: name must be a string, trimmed, max 20 characters; color must match `/^#[0-9a-fA-F]{6}$/`. Fall back to "Guest" and a default color if invalid.

### Verification checklist

- [ ] First visit asks for a name; refreshing does not ask again.
- [ ] Two tabs on the same board both show two users, with the correct names and colors.
- [ ] Your own entry is marked "(you)".
- [ ] Closing a tab removes that user from the list in the other tabs within a few seconds.
- [ ] Users on a different board do not appear in this board's list.
- [ ] Opening the same board in two tabs of the same browser shows two entries with the same name. **This is expected** (each tab is a separate connection); mention it in your report.
- [ ] A name made of spaces only is rejected, and a 100-character name is cut to 20.
- [ ] Turn off Wi-Fi briefly (or stop the server) and reconnect: you appear in the list again exactly once, not zero or two times.

### Common problems

- *You disappear from the list after a reconnect*: on the client, emit `board:join` again inside the `connect` handler, not only on first mount. Socket.IO gives you a new socket ID after reconnecting, so the server has no idea which board you were on.

---

## Step 10 — Live cursors

**Goal:** See other users' pointers move across the board with their name labels.

**What you will learn:** High-frequency events, throttling, volatile messages, DOM overlays on top of a canvas.

### Tasks

1. **Client:** listen for `pointermove` on the board wrapper (whether drawing or not). Convert to board units with `getBoardPoint()`.
2. **Throttle** cursor events so you send at most one every 50 ms (about 20 per second). Write a small `throttle(fn, ms)` helper yourself rather than installing a library, so you understand how it works.
3. Emit `cursor:move` with `{ x, y }`. On `pointerleave`, emit `cursor:leave`.
4. **Server:** on `cursor:move`, look up the sender's name and color from presence and send `socket.volatile.to(boardId).emit("cursor:moved", { socketId: socket.id, name, color, x, y })`. On `cursor:leave` and on `disconnect`, send `cursor:left`.
5. **Client (`CursorLayer.jsx`):** keep cursors in state as `{ [socketId]: { name, color, x, y, lastSeen } }`. Render each as an absolutely positioned element inside the board wrapper, using percentages (Section 6), with a small arrow icon in the user's color and a name label next to it.
6. Set `pointer-events: none` on the cursor layer so cursors never block drawing.
7. Add a CSS `transition: left 80ms linear, top 80ms linear` so cursors glide smoothly between updates.
8. Hide cursors that have not moved for 10 seconds.
9. Never show your own cursor from the server (you already see your real pointer).

### Verification checklist

- [ ] Moving the pointer in Tab A shows a labeled cursor moving in Tab B, in the matching position.
- [ ] The cursor appears in the same relative spot even when the two windows are different sizes.
- [ ] Cursors move smoothly, not in big jumps.
- [ ] Moving the pointer outside the board in A hides A's cursor in B.
- [ ] Closing Tab A removes its cursor in B immediately.
- [ ] You can draw "through" another user's cursor (it never blocks clicks).
- [ ] In the DevTools WS tab, moving the mouse continuously sends about 20 `cursor:move` messages per second, not hundreds.
- [ ] Cursors from another board never appear.

---

## Step 11 — Hardening and edge cases

**Goal:** The app stays stable with bad data, slow networks, and unexpected user behavior. This step is what turns a demo into a solid project.

**What you will learn:** Never trusting client data, limits, reconnection handling, defensive programming.

### Tasks

1. **Server validation (`validate.js`):** write `isValidElement(el)` that checks:
   - `type` is one of the four allowed types, `id` is a short string.
   - All coordinates and `size` are finite numbers within sensible bounds (for example −100 to 1700 horizontally, −100 to 1000 vertically, size 1–40).
   - `color` is a valid hex color.
   - Strokes have between 1 and 5,000 points, each a pair of finite numbers.
   - Reject anything else with `error:message` and do not store or broadcast it.
2. **Limits:** cap boards at 10,000 elements. Set Socket.IO `maxHttpBufferSize` to about 1 MB.
3. **Reconnection:** on reconnect, the client re-joins (from Step 9) and receives `board:state` again, then redraws. Make sure a stroke being drawn at the moment of disconnect is not lost visually; simplest approach is to queue `element:add` messages while disconnected and send them after re-joining. (Socket.IO already buffers emits while disconnected by default; verify that this works.)
4. **Duplicate protection:** ignore an incoming `element:added` whose `id` already exists in your local elements.
5. **Pointer edge cases:** handle `pointercancel` like `pointerup`; ignore a second finger while drawing (track the active `pointerId`).
6. **UI polish:** keyboard shortcuts (P = pen, E = eraser, R = rectangle, C = circle, L = line), tooltips on toolbar buttons, a layout that works on a laptop screen and a phone.
7. **Logging:** log joins, leaves, and rejected messages on the server with the board ID, so you can explain what happened during your demo.

### Verification checklist

- [ ] From the browser console, run `socket.emit("element:add", { element: { type: "hack" } })` (expose the socket on `window` temporarily): the server rejects it, other users see nothing, and the server keeps running.
- [ ] Send a stroke with 100,000 points from the console: it is rejected.
- [ ] Draw while the server is stopped, then start it: after reconnecting, the strokes reach the other tab and are saved.
- [ ] No element ever appears twice after reconnects.
- [ ] Two-finger touch on a phone does not create stray lines.
- [ ] All keyboard shortcuts work, and typing your name in the name prompt does **not** trigger them.
- [ ] The app is usable on a phone screen (toolbar fits or wraps, drawing works).

---

## Step 12 — Deployment and demo

**Goal:** A public link that works from any device, and a rehearsed demo.

**What you will learn:** Environment-specific configuration, production builds, hosting WebSocket servers.

### Tasks

1. **Database:** use a free MongoDB Atlas cluster. Allow connections from your host (Network Access).
2. **Server:** deploy `server/` to a host that supports WebSockets (for example Render or Railway free tiers). Set `MONGODB_URI`, `CLIENT_ORIGIN` (your deployed client URL), and use the `PORT` the host provides.
3. **Client:** set `VITE_SERVER_URL` to the deployed server URL and deploy `client/` to Vercel or Netlify.
4. **SPA routing:** add a rewrite so every path serves `index.html`. Without this, refreshing `/board/abc123` gives a 404.
   - Vercel: `vercel.json` → `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`
   - Netlify: `public/_redirects` → `/*  /index.html  200`
5. **Local network demo (backup plan):** run `npm run dev -- --host` in `client/`, set `VITE_SERVER_URL` and `CLIENT_ORIGIN` to your laptop's local IP, and open the app on your phone on the same Wi-Fi.

> Note: free hosting tiers often "sleep" after inactivity, and the first request can take 30–60 seconds. Open the app a few minutes before your demo to wake it up.

### Verification checklist

- [ ] The deployed site opens on your laptop and on your phone using mobile data (not just Wi-Fi).
- [ ] Laptop and phone on the same board sync drawings, cursors, and the online list.
- [ ] Refreshing a `/board/...` URL on the deployed site works (no 404).
- [ ] Drawings are still there the next day.
- [ ] The local network backup plan has been tested at least once.

---

## 8. Final acceptance test (demo script)

Run this exact script before submitting and again right before presenting. Every line must pass.

1. Open the home page, click "Create new board". A new URL appears.
2. Enter the name "Alice". The online list shows "Alice (you)".
3. Copy the link and open it on a second device (or another browser). Enter "Bob".
4. Both screens show 2 users online, and each sees the other's labeled cursor moving.
5. Alice draws a red freehand line with size 10. Bob sees it.
6. Bob draws a blue rectangle, a green circle, and a black line. Alice sees all three.
7. Alice erases part of Bob's rectangle. Bob sees the gap.
8. Open a third tab on a **different** new board. It is empty and shows 1 user; nothing from it reaches Alice or Bob.
9. Close Bob's tab. Alice's online list drops to 1 and Bob's cursor disappears.
10. Restart the server. Alice's status badge goes red, then green. Refreshing shows the full drawing.
11. Bob reopens the link. He sees the full drawing, including the erased gap.
12. Alice clicks "Clear board" and confirms. Both screens are empty. Refresh: still empty.

---

## 9. Report talking points

Topics that show understanding during your viva or in your written report:

- **WebSockets vs HTTP polling:** why a persistent two-way connection suits real-time apps, and what Socket.IO adds on top (rooms, reconnection, fallbacks).
- **Optimistic local rendering:** why the user draws locally first instead of waiting for the server.
- **Data model:** why the board is stored as an ordered list of vector elements instead of an image, and how that makes sync, persistence, and later undo possible.
- **Coordinate normalization:** how a fixed logical board size makes drawings consistent across screen sizes.
- **Rooms and isolation:** how `socket.data.boardId` stops users from writing to boards they have not joined.
- **Consistency:** if two users finish strokes at the same moment, they may briefly see them in different orders (this only matters when an eraser overlaps). After a refresh, everyone sees the server's order. This is a simple form of *eventual consistency*; more advanced apps use CRDTs (for example Yjs) to handle this.
- **Throttling and volatile messages:** why cursors are sent 20 times per second and may be dropped, while drawing events must never be dropped.
- **Write-through cache:** why the server keeps boards in memory and writes to MongoDB at the same time.
- **Security basics:** server-side validation, size limits, and why the client is never trusted.
- **Known limitations:** no authentication, anyone with the link can edit, same user in two tabs appears twice, single server instance (scaling to several servers would need the Socket.IO Redis adapter), and very large boards could approach MongoDB's 16 MB document limit.

---

## 10. Future work (next phase)

The current design already prepares for these:

- **Undo / redo:** every element has an `id` and `createdBy`, so "undo" can become a new event like `element:remove { id }` that removes the user's last element, with a per-user redo stack on the client.
- **Export:** because the board is redrawn from data, exporting to PNG is mostly `canvas.toBlob()` after drawing a white background; PDF can wrap that image.
- Other ideas: select and move elements, text tool, sticky notes, zoom and pan, read-only share links, and login.

---

## 11. Progress tracker

| Step | Done | Commit hash | Notes |
|------|------|-------------|-------|
| 0 Setup | [ ] | | |
| 1 Freehand pen | [ ] | | |
| 2 Color, size, eraser, clear | [ ] | | |
| 3 Shapes | [ ] | | |
| 4 Socket connection | [ ] | | |
| 5 Live sync | [ ] | | |
| 6 Rooms and links | [ ] | | |
| 7 Late joiners | [ ] | | |
| 8 MongoDB persistence | [ ] | | |
| 9 Names and online list | [ ] | | |
| 10 Live cursors | [ ] | | |
| 11 Hardening | [ ] | | |
| 12 Deployment and demo | [ ] | | |
