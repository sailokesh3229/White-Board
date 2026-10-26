// Keep both studioDomain.js copies identical. Separate deployment roots need
// local files; the server test checks that both use the same edit rules.
export const MAX_PAGES = 20;
export const FIRST_PAGE = "page_main";
export const BACKGROUNDS = ["plain", "dots", "grid", "ruled", "dark"];
export const makePage = (id = FIRST_PAGE, name = "Untitled page") => ({ id, name, background: "dots", elements: [] });
export const emptyStudio = () => ({ version: 2, title: "Untitled workspace", revision: 0, pages: [makePage()], receipts: [] });
export const publicStudio = (state) => ({ ...state, receipts: (state.receipts || []).slice(-128) });
export function migrateStudio(doc) {
  if (doc?.studio?.version === 2 && doc.studio.pages?.length) return structuredClone(doc.studio);
  const state = emptyStudio();
  state.pages[0].elements = (doc?.elements || []).map(e => ({ ...e, version: 1 }));
  return state;
}
const idOK = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(value);
const number = (n, min = -5000, max = 5000) => Number.isFinite(n) && n >= min && n <= max;
const color = value => typeof value === "string" && /^#[a-f\d]{6}$/i.test(value);
export function cleanObject(raw) {
  if (!raw || !idOK(raw.id)) throw new Error("Invalid object ID");
  if (!["stroke", "rect", "circle", "line", "arrow", "text", "note", "image"].includes(raw.type)) throw new Error("Unknown object type");
  if (!color(raw.color) || !number(raw.size, 1, 40)) throw new Error("Invalid drawing style");
  const el = { id: raw.id, type: raw.type, color: raw.color, size: raw.size, createdBy: String(raw.createdBy || "guest").slice(0, 40), createdAt: number(raw.createdAt, 0, 1e15) ? raw.createdAt : Date.now(), locked: !!raw.locked, layer: raw.layer === "base" ? "base" : "ink" };
  if (color(raw.fill)) el.fill = raw.fill;
  if (number(raw.opacity, 0.05, 1)) el.opacity = raw.opacity;
  const coords = names => { for (const key of names) { if (!number(raw[key])) throw new Error("Invalid coordinates"); el[key] = raw[key]; } };
  if (el.type === "stroke") {
    if (!["pen", "eraser", "highlighter"].includes(raw.tool) || !Array.isArray(raw.points) || !raw.points.length || raw.points.length > 5000) throw new Error("Invalid stroke");
    if (raw.points.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(n => number(n)))) throw new Error("Invalid stroke points");
    el.tool = raw.tool; el.points = raw.points.map(p => [...p]);
    if (raw.pressures !== undefined) {
      if (!Array.isArray(raw.pressures) || raw.pressures.length !== raw.points.length || !raw.pressures.every(p => number(p, 0, 1))) throw new Error("Invalid pressure data");
      el.pressures = [...raw.pressures];
    }
  } else if (["line", "arrow"].includes(el.type)) coords(["x1", "y1", "x2", "y2"]);
  else if (el.type === "circle") { coords(["cx", "cy"]); if (!number(raw.r, 1, 3000)) throw new Error("Invalid radius"); el.r = raw.r; }
  else {
    coords(["x", "y"]);
    if (!number(raw.width, 5, 4000) || !number(raw.height, 5, 4000)) throw new Error("Invalid object dimensions");
    el.width = raw.width; el.height = raw.height;
    if (["text", "note"].includes(el.type)) {
      if (typeof raw.text !== "string" || raw.text.length > 4000 || !number(raw.fontSize, 10, 160)) throw new Error("Invalid text");
      el.text = raw.text; el.fontSize = raw.fontSize; el.bold = !!raw.bold;
      el.align = ["left", "center", "right"].includes(raw.align) ? raw.align : "left";
    }
    if (el.type === "image") { if (!idOK(raw.assetId)) throw new Error("Invalid image reference"); el.assetId = raw.assetId; }
  }
  return el;
}
export function applyStudioAction(state, action, { trusted = false } = {}) {
  const next = structuredClone(state);
  const page = next.pages.find(p => p.id === action.pageId);
  if (action.type === "objects") {
    if (!page) throw new Error("This page no longer exists");
    if (!Array.isArray(action.changes) || !action.changes.length || action.changes.length > 300) throw new Error("Too many changes");
    const seen = new Set();
    action.changes.forEach(change => {
      if (!idOK(change.id) || seen.has(change.id)) throw new Error("Duplicate or invalid object ID");
      seen.add(change.id);
      const i = page.elements.findIndex(e => e.id === change.id), old = page.elements[i];
      if (!trusted && (old?.version ?? null) !== (change.expectedVersion ?? null)) throw new Error("Someone changed this object. Your board has been refreshed; try again.");
      if (change.value === null) { if (i >= 0) page.elements.splice(i, 1); }
      else {
        const value = trusted ? structuredClone(change.value) : cleanObject(change.value);
        if (value.id !== change.id) throw new Error("Object ID mismatch");
        value.version = trusted ? change.value.version : (old?.version || 0) + 1;
        if (i < 0) page.elements.push(value); else page.elements[i] = value;
      }
    });
  } else if (action.type === "page:add") {
    if (next.pages.length >= MAX_PAGES) throw new Error("A workspace can have up to 20 pages");
    if (!idOK(action.newId) || next.pages.some(p => p.id === action.newId)) throw new Error("Invalid page ID");
    const added = makePage(action.newId, String(action.name || `Page ${next.pages.length + 1}`).slice(0, 60));
    if (action.copyFrom) {
      const source = next.pages.find(p => p.id === action.copyFrom);
      if (!source) throw new Error("Source page no longer exists");
      added.background = source.background;
      added.elements = source.elements.map((e, i) => ({ ...e, id: `${action.newId}_${i}`, version: 1 }));
    }
    next.pages.push(added);
  } else if (action.type === "page:update") {
    if (!page) throw new Error("Page not found");
    if (typeof action.name === "string") page.name = action.name.trim().slice(0, 60) || "Untitled page";
    if (action.background !== undefined) { if (!BACKGROUNDS.includes(action.background)) throw new Error("Invalid background"); page.background = action.background; }
  } else if (action.type === "page:remove") {
    if (!page || next.pages.length <= 1) throw new Error("Keep at least one page");
    next.pages = next.pages.filter(p => p.id !== action.pageId);
  } else if (action.type === "page:order") {
    if (!page || ![-1, 1].includes(action.direction)) throw new Error("Invalid page move");
    const i = next.pages.indexOf(page), target = Math.max(0, Math.min(next.pages.length - 1, i + action.direction));
    next.pages.splice(i, 1); next.pages.splice(target, 0, page);
  } else if (action.type === "objects:order") {
    if (!page) throw new Error("Page not found");
    const i = page.elements.findIndex(e => e.id === action.objectId);
    if (i < 0 || !["front", "back"].includes(action.position)) throw new Error("Invalid object order");
    const [e] = page.elements.splice(i, 1);
    if (action.position === "front") page.elements.push(e); else page.elements.unshift(e);
  } else if (action.type === "title") {
    if (typeof action.title !== "string") throw new Error("Invalid title");
    next.title = action.title.trim().slice(0, 80) || "Untitled workspace";
  } else throw new Error("Unknown edit");
  if (next.pages.reduce((n, p) => n + p.elements.length, 0) > 10000) throw new Error("Workspace is full");
  return next;
}
export function optimisticAction(state, action) {
  // Assign the same versions that the server will assign to keep a queue of
  // local edits to the same object consistent, even while offline.
  return applyStudioAction(state, action);
}
