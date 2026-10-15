// All board-related events for one connected socket.
// The golden rule: the sender has already drawn its own change, so the server
// forwards it to everyone ELSE. socket.broadcast.emit skips the sender;
// io.emit would make the sender draw the same element twice.
export function registerBoardHandlers(io, socket, deps = {}) {
  socket.on("element:add", (payload) => {
    const element = payload?.element;
    if (!element) return; // full validation arrives in Phase 11
    socket.broadcast.emit("element:added", { element });
  });

  socket.on("board:clear", () => {
    socket.broadcast.emit("board:cleared", { by: "Someone" }); // real names in Phase 9
  });
}
