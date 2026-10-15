import { isValidBoardId, isValidPoint, sanitizeUser } from "../validate.js";

// All board-related events for one connected socket.
//
// Rooms: each board is a Socket.IO room named after its boardId. After a
// socket joins, we remember the board in socket.data.boardId, so later events
// don't carry a boardId at all. That also means a client can only ever write
// to the board it actually joined.
//
// The golden rule: the sender has already drawn its own change, so the server
// stores it and forwards it to everyone ELSE in the room. socket.to(room)
// skips the sender; io.to(room) would make the sender draw it twice.
//
// Database calls can fail, so every async handler catches its errors: one bad
// board must never crash the server for everyone else.
export function registerBoardHandlers(io, socket, { store, presence, logger = console }) {
  // Once nobody is left on a board, drop it from memory. It is reloaded
  // from the database the next time someone joins.
  function evictIfEmpty(boardId) {
    if (!io.sockets.adapter.rooms.has(boardId)) store.evict(boardId);
  }

  // presence:update goes to EVERYONE in the room (io.to), including the
  // sender, because everyone's list has to change, not just the others'.
  function sendPresence(boardId) {
    io.to(boardId).emit("presence:update", { users: presence.listUsers(boardId) });
  }

  function nameOf(boardId) {
    return presence.getUser(boardId, socket.id)?.name ?? "Someone";
  }

  // Shared by switching boards, failed loads and disconnecting. The socket is
  // no longer in the room here, so io.to(room) reaches everyone left.
  function removeFromBoard(boardId) {
    const name = nameOf(boardId);
    presence.removeUser(boardId, socket.id);
    sendPresence(boardId);
    io.to(boardId).emit("cursor:left", { socketId: socket.id });
    logger.log(`[board ${boardId}] leave ${name}`);
    evictIfEmpty(boardId);
  }

  function leaveCurrentBoard() {
    const boardId = socket.data.boardId;
    if (!boardId) return;
    socket.leave(boardId);
    socket.data.boardId = undefined;
    removeFromBoard(boardId);
  }

  socket.on("board:join", async (payload) => {
    const boardId = payload?.boardId;
    if (!isValidBoardId(boardId)) {
      socket.emit("error:message", { message: "Invalid board ID" });
      return;
    }

    const user = sanitizeUser(payload.user);
    if (socket.data.boardId !== boardId) leaveCurrentBoard();
    socket.join(boardId);
    socket.data.boardId = boardId;
    // Re-joining the same board (e.g. after a rename) just updates the entry.
    presence.addUser(boardId, socket.id, user);
    sendPresence(boardId);
    logger.log(`[board ${boardId}] join ${user.name}`);

    try {
      // Send the current board to the joiner only.
      const elements = await store.getElements(boardId);
      // If the socket switched boards while we were loading, this is stale.
      if (socket.data.boardId !== boardId) return;
      socket.emit("board:state", { elements });
    } catch (err) {
      logger.error(`[board ${boardId}] load failed: ${err.message}`);
      if (socket.data.boardId === boardId) leaveCurrentBoard();
      socket.emit("error:message", { message: "Could not load board, please try again" });
    }
  });

  socket.on("element:add", async (payload) => {
    const boardId = socket.data.boardId;
    if (!boardId) return; // never joined a board: ignore
    const element = payload?.element;
    if (!element) return; // full validation arrives in Phase 11

    try {
      // Store BEFORE broadcasting, so anyone joining a moment later gets it in
      // board:state. (The database write itself continues in the background.)
      await store.addElement(boardId, element);
      socket.to(boardId).emit("element:added", { element });
    } catch (err) {
      logger.error(`[board ${boardId}] add failed: ${err.message}`);
      socket.emit("error:message", { message: "Could not save your drawing, please refresh" });
    }
  });

  socket.on("board:clear", async () => {
    const boardId = socket.data.boardId;
    if (!boardId) return;
    try {
      await store.clearBoard(boardId);
      socket.to(boardId).emit("board:cleared", { by: nameOf(boardId) });
    } catch (err) {
      logger.error(`[board ${boardId}] clear failed: ${err.message}`);
    }
  });

  // Cursors are sent about 20 times per second. "volatile" lets Socket.IO
  // drop a message when the connection is busy: a lost cursor position is
  // replaced by the next one 50 ms later, unlike a drawing, which must never
  // be dropped.
  socket.on("cursor:move", (payload) => {
    const boardId = socket.data.boardId;
    const user = boardId && presence.getUser(boardId, socket.id);
    if (!user) return; // not on a board (yet)
    const { x, y } = payload ?? {};
    if (!isValidPoint(x, y)) return;
    socket.volatile.to(boardId).emit("cursor:moved", {
      socketId: socket.id,
      name: user.name,
      color: user.color,
      x,
      y,
    });
  });

  socket.on("cursor:leave", () => {
    const boardId = socket.data.boardId;
    if (!boardId) return;
    socket.to(boardId).emit("cursor:left", { socketId: socket.id });
  });

  // By the time "disconnect" fires, Socket.IO has already removed the socket
  // from its rooms; we still have to update presence and tidy up.
  socket.on("disconnect", () => {
    const boardId = socket.data.boardId;
    if (boardId) removeFromBoard(boardId);
  });
}
