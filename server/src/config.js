// CLIENT_ORIGIN can list several origins separated by commas, e.g. the
// deployed site plus a laptop's LAN address for the backup demo:
//   CLIENT_ORIGIN=https://my-board.vercel.app,http://192.168.1.20:5173
// A browser's Origin header never ends in "/", so a trailing slash copied from
// the address bar would silently fail CORS; strip it here instead.
export function parseOrigins(value) {
  const origins = String(value ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return origins.length > 0 ? origins : ["http://localhost:5173"];
}
