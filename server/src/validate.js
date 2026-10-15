import { BOARD_ID_REGEX, ELEMENT_TYPES, MAX_NAME_LENGTH, MAX_POINTS_PER_STROKE, MAX_SIZE, MIN_SIZE } from "./constants.js";

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const USER_ID_REGEX = /^u_[A-Za-z0-9_-]{1,32}$/;
const DEFAULT_NAME = "Guest";
const DEFAULT_COLOR = "#868e96";

// Board coordinates may go a little past the edges (a stroke can start or end
// just outside the board), but not wildly far.
const MIN_X = -100;
const MAX_X = 1700;
const MIN_Y = -100;
const MAX_Y = 1000;

export function isValidPoint(x, y) {
  return (
    Number.isFinite(x) && Number.isFinite(y) && x >= MIN_X && x <= MAX_X && y >= MIN_Y && y <= MAX_Y
  );
}

export function isValidBoardId(boardId) {
  return typeof boardId === "string" && BOARD_ID_REGEX.test(boardId);
}

// Never trust what the client sends: build a clean user object, falling back
// to safe defaults instead of rejecting the join outright.
export function sanitizeUser(user) {
  const rawName = typeof user?.name === "string" ? user.name.trim() : "";
  const name = rawName.slice(0, MAX_NAME_LENGTH).trim() || DEFAULT_NAME;
  const color = typeof user?.color === "string" && HEX_COLOR_REGEX.test(user.color) ? user.color : DEFAULT_COLOR;
  const userId = typeof user?.userId === "string" && USER_ID_REGEX.test(user.userId) ? user.userId : "u_unknown";
  return { userId, name, color };
}

const ELEMENT_ID_MAX_LENGTH = 40;
const MAX_RADIUS = 2000;
const MAX_SPAN = 1800; // widest a rectangle can be and still stay within the point bounds

function isFiniteBetween(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function isPointPair(point) {
  return Array.isArray(point) && point.length === 2 && isValidPoint(point[0], point[1]);
}

// Checks an incoming element and returns { element } with a CLEAN copy that
// holds only the allowed fields, or { error } with a short reason.
// Storing the copy (never the original object) means unknown extra fields,
// however large, never reach the database or other users.
export function cleanElement(el) {
  if (!el || typeof el !== "object" || Array.isArray(el)) return { error: "not an object" };
  if (!ELEMENT_TYPES.includes(el.type)) return { error: "unknown type" };
  if (typeof el.id !== "string" || el.id.length === 0 || el.id.length > ELEMENT_ID_MAX_LENGTH) {
    return { error: "bad id" };
  }
  if (!isFiniteBetween(el.size, MIN_SIZE, MAX_SIZE)) return { error: "bad size" };

  const isEraser = el.type === "stroke" && el.tool === "eraser";
  // Eraser strokes ignore color, so they may leave it out.
  const color = isEraser && el.color === undefined ? "#000000" : el.color;
  if (typeof color !== "string" || !HEX_COLOR_REGEX.test(color)) return { error: "bad color" };

  const base = {
    id: el.id,
    type: el.type,
    color,
    size: el.size,
    createdBy: typeof el.createdBy === "string" ? el.createdBy.slice(0, ELEMENT_ID_MAX_LENGTH) : "u_unknown",
    createdAt: Number.isFinite(el.createdAt) ? el.createdAt : Date.now(),
  };

  switch (el.type) {
    case "stroke": {
      if (el.tool !== "pen" && el.tool !== "eraser") return { error: "bad tool" };
      const { points } = el;
      if (!Array.isArray(points) || points.length < 1 || points.length > MAX_POINTS_PER_STROKE) {
        return { error: "bad point count" };
      }
      if (!points.every(isPointPair)) return { error: "bad point" };
      return { element: { ...base, tool: el.tool, points: points.map(([x, y]) => [x, y]) } };
    }
    case "rect": {
      const { x, y, width, height } = el;
      if (!isValidPoint(x, y) || !isFiniteBetween(width, 0, MAX_SPAN) || !isFiniteBetween(height, 0, MAX_SPAN)) {
        return { error: "bad rect" };
      }
      if (!isValidPoint(x + width, y + height)) return { error: "rect out of bounds" };
      return { element: { ...base, x, y, width, height } };
    }
    case "circle": {
      const { cx, cy, r } = el;
      if (!isValidPoint(cx, cy) || !isFiniteBetween(r, 0, MAX_RADIUS)) return { error: "bad circle" };
      return { element: { ...base, cx, cy, r } };
    }
    case "line": {
      const { x1, y1, x2, y2 } = el;
      if (!isValidPoint(x1, y1) || !isValidPoint(x2, y2)) return { error: "bad line" };
      return { element: { ...base, x1, y1, x2, y2 } };
    }
  }
  return { error: "unknown type" };
}

export function isValidElement(el) {
  return !cleanElement(el).error;
}
