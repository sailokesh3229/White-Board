# Folio — collaborative canvas for ideas

Folio turns a shared whiteboard into a creative studio. Draw, write, annotate pictures, organize work across pages, and present the result from one link. The editor combines a slide deck, live canvas, and tablet companion surface. It is built with React Canvas and Socket.IO, without a whiteboard SDK.

## Features

- Create a workspace from a blank page or an editable Brainstorm, Project Planner, or Storyboard template.
- Build up to 20 pages. Add, rename, duplicate, reorder, and delete pages. Switching pages saves automatically; deletion asks for confirmation.
- Draw with a pen or pressure-sensitive stylus, highlight, erase, and add lines, arrows, rectangles, and circles. Pan and zoom the 1600 × 900 canvas.
- Add editable text and sticky notes. Select, lasso, move, resize, lock, duplicate, reorder, and delete objects. Undo and redo local edits.
- Upload PNG, JPEG, or WebP pictures. The browser compresses them before upload and the server stores them separately from vector state. A locked image sits beneath annotations until unlocked.
- See collaborators and their cursors live. Share a workspace or tablet companion link. In stylus-only mode, fingers pan while the stylus writes.
- Choose paper backgrounds, temporarily hide annotations, present pages as slides, export a PNG, or print the deck to PDF.
- Keep editing during a temporary disconnection. Pending edits are stored locally and replayed with receipt IDs after reconnection. Object versions prevent silent overwrites of newer work.

Anyone with a workspace URL can edit it. Folio has no accounts or private permissions, so use it for coursework and group work rather than confidential material.

## Stack

| Layer | Technology | Role |
|---|---|---|
| Client | React 19, Vite 8, Canvas 2D | Editor, presentation, image compression, optimistic UI |
| Realtime API | Node.js, Express 5, Socket.IO 4 | Rooms, presence, serialized edits, validation, image routes |
| Storage | MongoDB, Mongoose | Workspace state and uploaded images |

Every workspace is a versioned document with ordered pages and vector objects. The server serializes edits per workspace, validates them, writes to MongoDB, and only then acknowledges and broadcasts the new revision. Each edit has a receipt ID, so reconnecting cannot duplicate a saved edit. Existing one-page boards load into the first page automatically; their original data remains in MongoDB.

## Run locally

1. Install Node.js 20+ and start MongoDB locally, or create a MongoDB Atlas cluster.
2. From the repository root run: npm run install:all
3. Copy server/.env.example to server/.env and client/.env.example to client/.env.
4. Set the variables below. Run npm run dev from the root and open http://localhost:5173.

| Variable | File | Example |
|---|---|---|
| MONGODB_URI | server/.env | mongodb://127.0.0.1:27017/whiteboard |
| CLIENT_ORIGIN | server/.env | http://localhost:5173 |
| PORT | server/.env | 4000 |
| VITE_SERVER_URL | client/.env | http://localhost:4000 |

CLIENT_ORIGIN accepts comma-separated origins. If you open the app at 127.0.0.1 instead of localhost, add that exact origin and point VITE_SERVER_URL to the matching server address. Vite embeds its variable at build time, so rebuild after changing it. Never commit .env files.

## Deploy to Vercel, Render, and MongoDB Atlas

1. Create a MongoDB Atlas cluster and database user. Add Render outbound IPs to Atlas Network Access, or use 0.0.0.0/0 for a course demo if fixed IPs are unavailable. Include /whiteboard in the URI and URL-encode special password characters.
2. Create a Render Web Service from this repository. Root directory: server. Build command: npm install. Start command: npm start. Set MONGODB_URI to the Atlas URI and CLIENT_ORIGIN to the exact Vercel origin, such as https://white-board-ohxu.vercel.app. Render supplies PORT.
3. Create a Vercel project from the same repository. Root directory: client. Framework: Vite. Build command: npm run build. Output directory: dist. Set VITE_SERVER_URL to the Render HTTPS service URL without a trailing slash. client/vercel.json handles deep links.
4. Redeploy both services after environment changes. Open Render /health and a fresh Vercel workspace. Open the same link on two devices to confirm live collaboration.

The existing deployment is https://white-board-ohxu.vercel.app. The client and server must both be deployed from the upgraded commit.

## Checks

Run npm test, npm run build --prefix client, and npm run lint --prefix client. Tests cover the original board protocol, versioned studio state, edit conflicts, replay receipts, page limits, validation, socket collaboration, and upload rejection. For a manual check, create a template workspace, add text and a picture, annotate it on a touch device, open the link in a second browser, add another page, and export the deck.

## Limits

- 20 pages and 10,000 vector objects per workspace.
- 100 uploads per workspace, each compressed to at most 900 KB. Input images must be PNG, JPEG, or WebP and no larger than 15 MB before compression.
- 6 MB of vector state per workspace in MongoDB; images are stored separately.
- Undo and redo track edits made in the current tab session. They do not undo someone else's work. If an offline change conflicts with a newer edit, Folio refreshes the board and reports the conflict.
- The tablet companion link opens the same workspace with a compact layout and stylus-only drawing option.

The original implementation record is in PROGRESS.md. spec.md and plan.md include the approved v2 scope above the original phase plan.
