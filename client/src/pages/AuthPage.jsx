import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext.js";
import Icon from "../components/Icon.jsx";

export default function AuthPage({ register = false }) {
  const { account, authenticate } = useAuth(), navigate = useNavigate(), location = useLocation();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [visible, setVisible] = useState(false);
  const requested = new URLSearchParams(location.search).get("next");
  const destination = requested && /^\/board\/[A-Za-z0-9_-]{6,32}(?:\?mode=tablet)?$/.test(requested) ? requested : "/";
  if (account) return <Navigate to={destination} replace/>;
  async function submit(event) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try { await authenticate(register ? "register" : "login", values); navigate(destination, { replace: true }); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const next = requested ? `?next=${encodeURIComponent(destination)}` : "";
  return <main className="auth-page"><Link to="/" className="brand"><span className="brand-symbol"><Icon name="layers" size={25}/></span>folio<span className="brand-period">.</span></Link><div className="auth-shell"><aside className="auth-story"><span className="eyebrow">YOUR IDEAS BELONG SOMEWHERE</span><h1>A little space.<br/>A whole lot<br/><em>of possibility.</em></h1><p>Sketch the first thought. Invite a friend. Build something worth sharing.</p><div className="auth-note"><Icon name="spark" size={28}/><span>Great things start<br/>with a small idea.</span></div><small>Draw. Write. Collaborate. Make it real.</small></aside><section className="auth-form-panel"><span className="eyebrow">{register ? "MAKE YOURSELF AT HOME" : "GOOD TO SEE YOU AGAIN"}</span><h2>{register ? "Your next idea starts here." : "Welcome back."}</h2><p>{register ? "Create your account and make room for your ideas." : "Sign in to open your workspaces and create together."}</p><form onSubmit={submit}>{register && <label>Your name<input name="name" autoComplete="name" maxLength={20} required placeholder="What should we call you?"/></label>}<label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required placeholder="you@example.com"/></label><label>Password<div className="password-field"><input name="password" type={visible ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} minLength={register ? 10 : undefined} maxLength={128} required placeholder={register ? "At least 10 characters" : "Enter your password"}/><button type="button" aria-label={visible ? "Hide password" : "Show password"} onClick={()=>setVisible(v=>!v)}><Icon name="eye" size={18}/></button></div></label>{register && <small className="password-hint">Use a unique password with at least 10 characters.</small>}{error && <p className="auth-error" role="alert">{error}</p>}<button className="primary-button wide-button" disabled={busy}>{busy ? "One moment…" : register ? "Create account" : "Sign in"}<Icon name="arrow" size={18}/></button></form><p className="auth-switch">{register ? "Already have an account?" : "New to Folio?"} <Link to={`${register ? "/login" : "/signup"}${next}`}>{register ? "Sign in" : "Create an account"}</Link></p><div className="auth-assurance"><Icon name="lock" size={15}/>One account. All your creative spaces.</div></section></div></main>;
}
