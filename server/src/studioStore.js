import { emptyStudio, migrateStudio, applyStudioAction, publicStudio } from "./studioDomain.js";

export function createStudioStore(persistence = {}) {
  const memory = new Map(), cache = new Map(), queues = new Map();
  const load = persistence.load || (async id => memory.get(id));
  const save = persistence.save || (async (id, state) => memory.set(id, { studio: structuredClone(state) }));
  async function get(id) {
    if (!cache.has(id)) {
      const loading = Promise.resolve(load(id)).then(doc => doc ? migrateStudio(doc) : emptyStudio());
      cache.set(id, loading);
      loading.catch(() => { if (cache.get(id) === loading) cache.delete(id); });
    }
    return publicStudio(await cache.get(id));
  }
  function act(id, action, userId) {
    const operation = (queues.get(id) || Promise.resolve()).catch(() => {}).then(async () => {
      const state = await get(id);
      if (typeof action?.id !== "string" || !/^[A-Za-z0-9_-]{6,40}$/.test(action.id)) throw new Error("Invalid edit ID");
      if (state.receipts.includes(action.id)) return { duplicate: true, state };
      const cleanAction = structuredClone(action);
      if (cleanAction.type === "objects") for (const change of cleanAction.changes || []) {
        if (change.value) change.value.createdBy = userId;
      }
      const next = applyStudioAction(state, cleanAction);
      next.revision = state.revision + 1;
      next.receipts = [...state.receipts, action.id].slice(-128);
      // Images live in a separate collection. Bound the board itself in bytes,
      // since an element count alone cannot prevent MongoDB's 16 MB ceiling.
      if (Buffer.byteLength(JSON.stringify(next)) > 6_000_000) throw new Error("Workspace is full. Export or use a new workspace.");
      await save(id, next); // Acknowledgement means the database accepted it.
      cache.set(id, Promise.resolve(next));
      return { state: publicStudio(next) };
    });
    queues.set(id, operation);
    operation.finally(() => { if (queues.get(id) === operation) queues.delete(id); }).catch(() => {});
    return operation;
  }
  function evict(id) { if (!queues.has(id)) cache.delete(id); }
  return { get, act, evict };
}
