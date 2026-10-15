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
export function registerBoardHandlers(io, socket, { store, logger = console }) {
  socket.on("board:join", async (payload) => {
    const boardId = payload?.boardId;
    if (!isValidBoardId(boardId)) {
      socket.emit("error:message", { message: "Invalid board ID" });
      return;
    }

    const previous = socket.data.boardId;
    if (previous && previous !== boardId) socket.leave(previous);

    socket.join(boardId);
    socket.data.boardId = boardId;
    logger.log(`[board ${boardId}] join ${socket.id}`);

    // Send the current board to the joiner only.
    const elements = await store.getElements(boardId);
    // If the socket switched boards while we were loading, this is stale.
    if (socket.data.boardId !== boardId) return;
    socket.emit("board:state", { elements });
  });

  socket.on("element:add", async (payload) => {
    const boardId = socket.data.boardId;
    if (!boardId) return; // never joined a board: ignore
    const element = payload?.element;
    if (!element) return; // full validation arrives in Phase 11

    // Store BEFORE broadcasting, so anyone joining a moment later gets it in board:state.
    await store.addElement(boardId, element);
    socket.to(boardId).emit("element:added", { element });
  });

  socket.on("board:clear", async () => {
    const boardId = socket.data.boardId;
    if (!boardId) return;
    await store.clearBoard(boardId);
    socket.to(boardId).emit("board:cleared", { by: "Someone" }); // real names in Phase 9
  });
}
