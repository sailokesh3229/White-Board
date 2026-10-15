import { BOARD_ID_REGEX } from "./constants.js";

export function isValidBoardId(boardId) {
  return typeof boardId === "string" && BOARD_ID_REGEX.test(boardId);
}
