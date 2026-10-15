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
