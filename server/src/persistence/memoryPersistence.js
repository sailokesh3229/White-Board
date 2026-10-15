// Keeps boards in a plain Map. Used before MongoDB exists (Phase 7) and in
// every test, so tests never need a running database. It has the same three
// async methods as mongoPersistence, so the board store can't tell them apart.
export function createMemoryPersistence() {
  const boards = new Map(); // boardId -> elements[]

  return {
    async load(boardId) {
      // Return a copy so the store's cache and this "database" never share an array.
      return [...(boards.get(boardId) ?? [])];
    },
    async append(boardId, element) {
      if (!boards.has(boardId)) boards.set(boardId, []);
      boards.get(boardId).push(element);
    },
    async clear(boardId) {
      boards.set(boardId, []);
    },
  };
}
