import { nanoid } from "nanoid";
import { MAX_NAME_LENGTH } from "./constants.js";

const STORAGE_KEY = "whiteboard:user";

// Distinct colors for cursors and the online list (not for drawing).
const PALETTE = [
  "#e03131",
  "#c2255c",
  "#9c36b5",
  "#6741d9",
  "#1971c2",
  "#0c8599",
  "#2f9e44",
  "#66a80f",
  "#f08c00",
  "#e8590c",
];

// No login: identity is just a random ID, a color and a name kept in this
// browser. localStorage can be unavailable (private mode, blocked storage),
// so every access is wrapped; the app still works, it just won't remember you.
function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function save(user) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Storage unavailable: keep going without remembering.
  }
}

export function cleanName(name) {
  return name.trim().slice(0, MAX_NAME_LENGTH).trim();
}

// Returns { userId, name, color }. Creates and saves the ID and color on the
// first visit; name is "" until the user picks one.
export function getUser() {
  const saved = load();
  if (saved?.userId && saved?.color) return { name: "", ...saved };

  const user = {
    userId: "u_" + nanoid(8),
    name: "",
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
  };
  save(user);
  return user;
}

export function setName(name) {
  const user = { ...getUser(), name: cleanName(name) };
  save(user);
  return user;
}
