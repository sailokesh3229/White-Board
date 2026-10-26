import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { nanoid } from "nanoid";
import { BOARD_ID_REGEX } from "../lib/constants.js";
import { extractBoardId } from "../lib/boardLink.js";
import Icon from "../components/Icon.jsx";
import { useAuth } from "../lib/authContext.js";

const starts = [
  { key: "blank", icon: "plus", title: "Blank space", detail: "Start with a clean canvas", className: "start-blank" },
  { key: "brainstorm", icon: "spark", title: "Brainstorm", detail: "Catch every good idea", className: "start-brainstorm" },
  { key: "kanban", icon: "grid", title: "Project planner", detail: "Ideas into action", className: "start-kanban" },
  { key: "story", icon: "present", title: "Storyboard", detail: "A story, frame by frame", className: "start-story" },
];

export default function HomeStudio() {
  const navigate = useNavigate();
  const { account, logout } = useAuth();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  let recent = [];
  try { recent = account ? JSON.parse(localStorage.getItem(`folio:recent:${account.id}`) || "[]") : []; } catch { /* Recent boards are optional. */ }

  function create(template = "blank") {
    const id = nanoid(10);
    if (template !== "blank") sessionStorage.setItem(`folio:template:${id}`, template);
    navigate(`/board/${id}`);
  }
  function join(event) {
    event.preventDefault();
    const id = extractBoardId(input.trim());
    if (!BOARD_ID_REGEX.test(id)) { setError("Paste a workspace link or ID to join."); return; }
    navigate(`/board/${id}`);
  }

  return <main className="folio-home">
    <header className="home-header"><a className="brand" href="/"><span className="brand-symbol"><Icon name="layers" size={25}/></span>folio<span className="brand-period">.</span></a><span className="header-tagline">A place for ideas to take shape.</span><div className="home-account-actions">{account ? <><span className="account-name">Hello, {account.name}</span><button className="quiet-button" onClick={()=>logout().catch(e=>setError(e.message))}>Sign out</button></> : <><a href="/login" className="quiet-button">Sign in</a><a href="/signup" className="primary-button">Create account</a></>}</div></header>
    <section className="hero"><div className="hero-copy"><div className="eyebrow"><span/>THE CREATIVE WORKSPACE</div><h1>Think together.<br/><em>Make it real.</em></h1><p>Turn rough thoughts into something worth sharing. Draw, write, bring in images, and build your story across pages—all together, in real time.</p><button className="hero-action" onClick={()=>create()}><span>Start creating</span><Icon name="arrow" size={22}/></button><div className="hero-footnote"><span className="hero-avatars"><i>✳</i><i>✦</i><i>●</i></span>A free space for your next big idea.</div></div>
      <div className="hero-art" aria-hidden="true"><div className="art-glow"/><div className="art-card art-card-back"><div className="art-card-top"><span/><span/><span/></div><div className="art-dots"/><div className="art-yellow-note">what if<br/>we tried<br/><b>this?</b></div><div className="art-curve"/></div><div className="art-card art-card-front"><div className="art-title"><i>✦</i> your next big idea</div><div className="art-squiggle"/><div className="art-photo"><span>↗</span></div><div className="art-pink-note">make it<br/>happen! <b>✳</b></div><div className="art-arrow">↘</div></div><div className="hero-sticker sticker-one">✽</div><div className="hero-sticker sticker-two">✦</div></div></section>
    <section id="start" className="home-start"><div className="section-heading"><div><span className="eyebrow">YOUR NEXT CANVAS</span><h2>Where shall we begin?</h2></div><p>Pick a spark. Make it your own.</p></div><div className="start-grid">{starts.map(item=><button key={item.key} className="start-card" onClick={()=>create(item.key)}><div className={`start-illustration ${item.className}`}><Icon name={item.icon} size={30}/><span>✦</span></div><span className="start-title">{item.title}<Icon name="arrow" size={17}/></span><small>{item.detail}</small></button>)}</div>
      <div className="join-panel"><div><span className="eyebrow">ALREADY HAVE A LINK?</span><h3>Jump back into the room.</h3><p>Every space is better when shared.</p></div><form onSubmit={join}><label htmlFor="workspace-link">Workspace link or ID</label><div className="join-input-wrap"><input id="workspace-link" value={input} onChange={e=>{setInput(e.target.value);setError("");}} placeholder="Paste a link or ID here" aria-invalid={!!error}/><button type="submit" aria-label="Join workspace"><Icon name="arrow" size={20}/></button></div>{error&&<span className="form-error">{error}</span>}</form></div>
      {recent.length>0&&<div className="recent-spaces"><div className="section-heading"><div><span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h2>Your recent spaces</h2></div></div><div className="recent-grid">{recent.slice(0,6).map(board=><button key={board.id} onClick={()=>navigate(`/board/${board.id}`)}><span className="recent-symbol"><Icon name="layers" size={20}/></span><span><b>{board.title||"Untitled workspace"}</b><small>{board.pages||1} {(board.pages||1)===1?"page":"pages"} · {new Date(board.updated).toLocaleDateString()}</small></span><Icon name="arrow" size={17}/></button>)}</div></div>}
    </section><footer className="home-footer"><span className="brand"><span className="brand-symbol"><Icon name="layers" size={20}/></span>folio<span className="brand-period">.</span></span><span>For the curious minds who make things together.</span><small>Think it. Draw it. Share it.</small></footer>
  </main>;
}
