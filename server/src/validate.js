import { BOARD_ID_REGEX, MAX_NAME_LENGTH } from "./constants.js";

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
