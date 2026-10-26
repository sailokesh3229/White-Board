import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { accountRequest } from "./api.js";
import { socket } from "./socket.js";
import { AuthContext, useAuth } from "./authContext.js";

function notifyAccountChange(mode) {
  try { localStorage.setItem("folio:account-event", `${mode}:${Date.now()}:${Math.random()}`); } catch { /* Sessions still work when local storage is unavailable. */ }
}

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try { const result = await accountRequest("me"); setAccount(result.user); setError(""); }
    catch (e) { setAccount(null); setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let alive = true;
    accountRequest("me").then(result => { if (alive) setAccount(result.user); }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    const expired = error => { if (/sign in|session/i.test(error.message)) refresh(); };
    const disconnected = reason => { if (reason === "io server disconnect") refresh(); };
    const synchronized = event => {
      if (event.key !== "folio:account-event") return;
      if (event.newValue?.startsWith("logout:")) { socket.disconnect(); setAccount(null); } else refresh();
    };
    socket.on("connect_error", expired); socket.on("disconnect", disconnected); window.addEventListener("storage", synchronized);
    return () => { socket.off("connect_error", expired); socket.off("disconnect", disconnected); window.removeEventListener("storage", synchronized); };
  }, [refresh]);
  const authenticate = useCallback(async (mode, values) => { const result = await accountRequest(mode, values); setAccount(result.user); setError(""); notifyAccountChange("login"); return result.user; }, []);
  const logout = useCallback(async () => { await accountRequest("logout", {}); socket.disconnect(); setAccount(null); notifyAccountChange("logout"); }, []);
  const value = useMemo(() => ({ account, loading, error, refresh, authenticate, logout }), [account, loading, error, refresh, authenticate, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function AccountGate({ children }) {
  const { account, loading } = useAuth(), location = useLocation();
  if (loading) return <div className="account-loading"><span className="loading-orbit"/><p>Opening your space…</p></div>;
  if (!account) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace/>;
  return children;
}
