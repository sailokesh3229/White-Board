import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { accountRequest } from "./api.js";
import { socket } from "./socket.js";
import { AuthContext, useAuth } from "./authContext.js";

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
  useEffect(() => { const expired = error => { if (/sign in|session/i.test(error.message)) refresh(); }; socket.on("connect_error", expired); return () => socket.off("connect_error", expired); }, [refresh]);
  const authenticate = useCallback(async (mode, values) => { const result = await accountRequest(mode, values); setAccount(result.user); setError(""); return result.user; }, []);
  const logout = useCallback(async () => { await accountRequest("logout", {}); socket.disconnect(); setAccount(null); }, []);
  const value = useMemo(() => ({ account, loading, error, refresh, authenticate, logout }), [account, loading, error, refresh, authenticate, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function AccountGate({ children }) {
  const { account, loading } = useAuth(), location = useLocation();
  if (loading) return <div className="account-loading"><span className="loading-orbit"/><p>Opening your space…</p></div>;
  if (!account) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace/>;
  return children;
}
