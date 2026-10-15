# Real-Time Collaborative Whiteboard

A browser whiteboard where several people draw together in real time. Each board has its own shareable URL, and boards are saved to MongoDB.

> This README is started in Phase 8 and completed in Phase 12. See `spec.md` for the full specification and `plan.md` for the build plan.

## Setup

```bash
npm run install:all
cp server/.env.example server/.env
cp client/.env.example client/.env
npm run dev          # starts the server (port 4000) and the client (http://localhost:5173)
npm test             # runs server and client tests (no database needed)
```

## MongoDB

The server connects to MongoDB **before** it starts listening, and exits with a clear message if it can't. Set the connection string as `MONGODB_URI` in `server/.env`.

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
3. Under **Network Access**, allow your IP address (or `0.0.0.0/0` for a deployed server).
4. Click **Connect → Drivers** and copy the connection string. Put it in `server/.env`, adding the database name `whiteboard`:

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/whiteboard
```

Never commit `server/.env`; it is git-ignored.
