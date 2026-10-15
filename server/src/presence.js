// Who is on which board right now. This lives only in memory and is never
// saved: it only matters while people are connected.
//
// Keyed by socket ID, not user ID: the same person in two tabs is two
// connections, so they appear twice (expected, see spec Step 9).
export function createPresence() {
  const boards = new Map(); // boardId -> Map<socketId, { userId, name, color }>

  function addUser(boardId, socketId, user) {
    if (!boards.has(boardId)) boards.set(boardId, new Map());
    boards.get(boardId).set(socketId, user);
  }

  function removeUser(boardId, socketId) {
    const users = boards.get(boardId);
    if (!users) return;
    users.delete(socketId);
    if (users.size === 0) boards.delete(boardId); // don't keep empty boards around
  }

  function getUser(boardId, socketId) {
    return boards.get(boardId)?.get(socketId);
  }

  // The shape sent to clients in presence:update.
  function listUsers(boardId) {
    const users = boards.get(boardId) ?? new Map();
    return [...users].map(([socketId, { name, color }]) => ({ socketId, name, color }));
  }

  function hasBoard(boardId) {
    return boards.has(boardId);
  }

  return { addUser, removeUser, getUser, listUsers, hasBoard };
}
