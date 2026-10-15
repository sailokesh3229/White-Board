// The server's "source of truth" for board contents.
//
// Write-through cache: every board that someone is using is kept in memory,
// so joins are fast and a new element can be stored and forwarded right away.
// Every change is ALSO written to the persistence layer (MongoDB from Phase 8),
// so nothing is lost when the server restarts or the board is evicted.
export function createBoardStore(persistence, { logger = console } = {}) {
  // boardId -> Promise<elements[]>. We cache the promise, not the array, so
  // two people joining at the same moment share ONE load instead of racing.
  const cache = new Map();
  // boardId -> Promise of the last queued write for that board.
  const pendingWrites = new Map();

  function afterWrites(boardId) {
    return pendingWrites.get(boardId) ?? Promise.resolve();
  }

  // Writes for one board run one after another, in the order they arrived, so
  // the database keeps the same element order as the cache. Order matters:
  // an eraser stroke only erases what was drawn before it.
  function queueWrite(boardId, label, write) {
    const run = afterWrites(boardId)
      .then(write)
      .catch((err) => logger.error(`[board ${boardId}] ${label} failed: ${err.message}`));
    pendingWrites.set(boardId, run);
    run.then(() => {
      if (pendingWrites.get(boardId) === run) pendingWrites.delete(boardId);
    });
  }

  function getElements(boardId) {
    if (!cache.has(boardId)) {
      // Wait for queued writes first, so a reload right after an evict
      // doesn't miss elements that are still on their way to the database.
      const loading = afterWrites(boardId)
        .then(() => persistence.load(boardId))
        .then((elements) => [...elements]);
      cache.set(boardId, loading);
      // Don't keep a failed load in the cache; the next join should retry.
      loading.catch(() => {
        if (cache.get(boardId) === loading) cache.delete(boardId);
      });
    }
    return cache.get(boardId);
  }

  // Resolves once the element is in the cache (so it can be broadcast);
  // the database write continues in the background.
  async function addElement(boardId, element) {
    const elements = await getElements(boardId);
    elements.push(element);
    queueWrite(boardId, "append", () => persistence.append(boardId, element));
    return elements.length;
  }

  async function clearBoard(boardId) {
    cache.set(boardId, Promise.resolve([]));
    queueWrite(boardId, "clear", () => persistence.clear(boardId));
  }

  // Frees memory once nobody is on the board; it reloads on the next join.
  function evict(boardId) {
    cache.delete(boardId);
  }

  // Resolves when all queued writes for a board are done (tests use this).
  function flush(boardId) {
    return afterWrites(boardId);
  }

  return { getElements, addElement, clearBoard, evict, flush };
}
