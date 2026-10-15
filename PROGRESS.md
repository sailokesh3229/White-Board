# Progress log

Real-time collaborative whiteboard. One entry per phase (see plan.md Section 6.2).

## Phase 0 — Project setup (2026-10-15)
- Status: done, awaiting manual verification
- Commit: d35dfbf
- Tests: server 2 passed, client 2 passed
- Notes: Node v24.20.0. Kept the Vite template's oxlint config. `npm audit` reports 3 high-severity advisories in nodemon's dev-only file watcher (braces/chokidar); nothing ships to production. MongoDB is not installed on this machine yet (needed in Phase 8).
