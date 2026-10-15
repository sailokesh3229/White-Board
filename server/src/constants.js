// Shared constants. Keep in sync with the other copy in client/src/lib/constants.js.
export const BOARD_WIDTH = 1600;
export const BOARD_HEIGHT = 900;
export const MIN_SIZE = 1;
export const MAX_SIZE = 40;
export const MAX_POINTS_PER_STROKE = 5000;
export const MAX_ELEMENTS_PER_BOARD = 10000;
export const MAX_NAME_LENGTH = 20;
export const CURSOR_THROTTLE_MS = 50;
export const BOARD_ID_REGEX = /^[A-Za-z0-9_-]{6,32}$/;
export const ELEMENT_TYPES = ["stroke", "rect", "circle", "line"];
