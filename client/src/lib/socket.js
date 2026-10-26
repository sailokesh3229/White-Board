import { io } from "socket.io-client";
import { API_URL } from "./api.js";

// One shared socket for the whole app. Every component imports this same
// object, so there is never more than one connection per tab.
// autoConnect: false lets the board page decide when to connect.
export const socket = io(API_URL, { autoConnect: false, withCredentials: true });

// Development only: lets you run the spec's console tests, e.g.
// __socket.emit("element:add", { element: { type: "hack" } })
if (import.meta.env.DEV) window.__socket = socket;
