# Progress log

Real-time collaborative whiteboard. One entry per phase (see plan.md Section 6.2).

## Phase 0 — Project setup (2026-10-15)
- Status: done, awaiting manual verification
- Commit: d35dfbf
- Tests: server 2 passed, client 2 passed
- Notes: Node v24.20.0. Kept the Vite template's oxlint config. `npm audit` reports 3 high-severity advisories in nodemon's dev-only file watcher (braces/chokidar); nothing ships to production. MongoDB is not installed on this machine yet (needed in Phase 8).

## Phase 1 — Freehand pen (2026-10-15)
- Status: done, awaiting manual verification
- Commit: 344d038
- Tests: server 2 passed, client 6 passed
- Notes: Pen is hardcoded to #1e1e1e / size 4 as planned. `createdBy` is a placeholder "local" until Phase 9. Temporary "Redraw (debug)" button is below the board (remove in Phase 3).

## Phase 2 — Color, size, eraser, clear (2026-10-15)
- Status: done, awaiting manual verification
- Commit: 2a29fb6
- Tests: server 2 passed, client 6 passed
- Notes: Canvas exposes a `clear()` method to Board through a ref (React 19 `ref` prop + `useImperativeHandle`), so board data stays inside Canvas. Eraser strokes still store the current color, but drawing ignores it.

## Phase 3 — Shapes (2026-10-15)
- Status: done, awaiting manual verification
- Commit: af2a409
- Tests: server 2 passed, client 14 passed
- Notes: Single-user whiteboard complete (spec milestone). Debug redraw button removed. A rectangle is kept if either side is ≥ 3 units (spec: ignore only when both are under 3).

## Phase 4 — Socket.IO connection (2026-10-15)
- Status: done, awaiting manual verification
- Commit: f7b1a2f
- Tests: server 3 passed, client 14 passed
- Notes: Added `socket.io-client` as a server devDependency (needed by the integration tests in plan Section 3.1). `createServer` also accepts a `logger` option so tests run silently.

## Phase 5 — Live sync on one shared board (2026-10-15)
- Status: done, awaiting manual verification
- Commit: 603a206
- Tests: server 6 passed, client 14 passed
- Notes: Server ignores `element:add` without an element (full validation in Phase 11). A remote clear keeps your in-progress stroke visible. Expected limitation: late joiners see an empty board (fixed in Phase 7). E2E check against the live dev server: CORS handshake allows http://localhost:5173 and a second client received the element.

## Browser verification of Phases 3–5 (2026-10-15)
- Checked in Chrome with two tabs on /board/test123:
  - Shapes: rect dragged up-left, circle and line all correct. A click with no drag creates nothing.
  - Sync: A → B (pen, all 3 shapes, eraser gap) and B → A both work.
  - Clear: clearing in B wiped A and showed the "Board was cleared" toast.
  - Connections: server log shows one open connection per tab (no Strict Mode leak).
  - Reconnect: stopping the server turned the badge red; restarting turned it green without a refresh.
  - Console: no errors or React warnings on page load.
- Observed: the 16:9 board is taller than a ~700px-high laptop viewport, so the bottom needs scrolling.

## Phase 6 — Rooms and shareable links (2026-10-15)
- Status: done, awaiting manual verification
- Commit: eff2aa4
- Tests: server 10 passed, client 18 passed
- Notes: Client rejects malformed board IDs before connecting (server still validates). `extractBoardId` lives in `client/src/lib/boardLink.js` (new file, with tests). Browser-checked: create board, A↔B sync, C on another board isolated both ways, invalid-board page, join by full URL, in-place board switch leaves the old room. Copy link not verifiable via automation (clipboard needs a real user click) — manual check.

## Phase 7 — Late joiners, in-memory store (2026-10-15)
- Status: done, awaiting manual verification
- Commit: c44308c
- Tests: server 17 passed, client 18 passed
- Notes: Store caches the load *promise* per board (concurrent joins share one load) and queues writes per board so the database keeps element order. Store also exposes `flush(boardId)` (for tests). A stale `board:state` is not sent if the socket switched boards during the load. Browser-checked: tab B reloaded and received A's pen stroke, rectangle and eraser stroke; other board stays empty. Expected limitation: memory is wiped on server restart (fixed in Phase 8).

## Phase 8 — MongoDB persistence (2026-10-15)
- Status: done, awaiting manual verification
- Commit: 8f72f0a
- Tests: server 26 passed, client 18 passed
- Notes: MongoDB 9.0.2 installed locally (Windows service, auto-start). 5 s timeouts (serverSelectionTimeoutMS, bufferTimeoutMS). Writes are queued per board so MongoDB keeps drawing order; failed writes are logged and the element stays in the cache. Load failure → `error:message`, socket leaves the room, server keeps running. Board is evicted from memory when its last socket leaves. Browser-checked: 4 elements saved in order to MongoDB; drawing survived a server restart; A redrew from the server after reconnecting. Not verified automatically: stopping MongoDB while the server runs (needs an admin terminal: `net stop MongoDB`).
