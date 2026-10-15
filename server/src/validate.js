import { BOARD_ID_REGEX, MAX_NAME_LENGTH } from "./constants.js";

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const USER_ID_REGEX = /^u_[A-Za-z0-9_-]{1,32}$/;
const DEFAULT_NAME = "Guest";
const DEFAULT_COLOR = "#868e96";

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
