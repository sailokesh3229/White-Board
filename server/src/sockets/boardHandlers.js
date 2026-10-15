import { isValidBoardId } from "../validate.js";

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
export function registerBoardHandlers(io, socket, { store, logger = console }) {
  // Once nobody is left on a board, drop it from memory. It is reloaded
  // from the database the next time someone joins.
  function evictIfEmpty(boardId) {
    if (!io.sockets.adapter.rooms.has(boardId)) store.evict(boardId);
  }

  function leaveCurrentBoard() {
    const boardId = socket.data.boardId;
    if (!boardId) return;
    socket.leave(boardId);
    socket.data.boardId = undefined;
    logger.log(`[board ${boardId}] leave ${socket.id}`);
    evictIfEmpty(boardId);
  }

  socket.on("board:join", async (payload) => {
    const boardId = payload?.boardId;
    if (!isValidBoardId(boardId)) {
      socket.emit("error:message", { message: "Invalid board ID" });
      return;
    }

    if (socket.data.boardId !== boardId) leaveCurrentBoard();
    socket.join(boardId);
    socket.data.boardId = boardId;
    logger.log(`[board ${boardId}] join ${socket.id}`);

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
      socket.to(boardId).emit("board:cleared", { by: "Someone" }); // real names in Phase 9
    } catch (err) {
      logger.error(`[board ${boardId}] clear failed: ${err.message}`);
    }
  });

  // By the time "disconnect" fires, Socket.IO has already removed the socket
  // from its rooms, so we only need to log and tidy up.
  socket.on("disconnect", () => {
    const boardId = socket.data.boardId;
    if (!boardId) return;
    logger.log(`[board ${boardId}] leave ${socket.id}`);
    evictIfEmpty(boardId);
  });
}
