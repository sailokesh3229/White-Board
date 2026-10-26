import { isValidBoardId, isValidPoint } from "./validate.js";

export function registerStudioHandlers(io, socket, { studio, presence, logger = console }) {
  socket.on("studio:open", async ({ boardId } = {}, ack) => {
    if (!isValidBoardId(boardId) || socket.data.boardId !== boardId) return ack?.({ ok: false, error: "Join this workspace first" });
    try {
      const state = await studio.get(boardId);
      if (socket.data.boardId !== boardId) return;
      socket.data.studioReady = boardId;
      ack?.({ ok: true, state });
    } catch (error) { logger.error(`Studio load: ${error.message}`); ack?.({ ok: false, error: "Could not load workspace. Please reconnect." }); }
  });
  socket.on("studio:action", async (action, ack) => {
    const id = socket.data.boardId;
    if (!id || socket.data.studioReady !== id) return ack?.({ ok: false, error: "Workspace is not ready" });
    try {
      const user = presence.getUser(id, socket.id);
      const result = await studio.act(id, action, user?.userId || "guest");
      if (!result.duplicate) io.to(id).emit("studio:changed", { actionId: action.id, state: result.state });
      ack?.({ ok: true, ...result });
    } catch (error) {
      logger.warn(`[board ${id}] edit rejected: ${error.message}`);
      ack?.({ ok: false, error: error.message, state: await studio.get(id).catch(() => undefined) });
    }
  });
  socket.on("studio:pointer", (data) => {
    const id = socket.data.boardId, user = id && presence.getUser(id, socket.id);
    if (!user || !isValidPoint(data?.x, data?.y) || typeof data.pageId !== "string") return;
    socket.volatile.to(id).emit("studio:pointer", { socketId: socket.id, name: user.name, color: user.color, x: data.x, y: data.y, pageId: data.pageId, laser: !!data.laser, at: Date.now() });
  });
  socket.on("disconnect", () => { const id = socket.data.boardId; if (id && !io.sockets.adapter.rooms.has(id)) studio.evict(id); });
}
