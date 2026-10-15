import { io } from "socket.io-client";

// One shared socket for the whole app. Every component imports this same
// object, so there is never more than one connection per tab.
// autoConnect: false lets the board page decide when to connect.
export const socket = io(import.meta.env.VITE_SERVER_URL, { autoConnect: false });
