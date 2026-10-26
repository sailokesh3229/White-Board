import {useState,useEffect} from "react";
import {socket} from "../lib/socket.js";
export default function StudioCursors({pageId}){
 const [cursors,setCursors]=useState({});
 useEffect(()=>{function move(data){if(data.socketId!==socket.id)setCursors(old=>({...old,[data.socketId]:{...data,received:Date.now()}}));}function leave({socketId}){setCursors(old=>{const next={...old};delete next[socketId];return next;});}socket.on("studio:pointer",move);socket.on("cursor:left",leave);const timer=setInterval(()=>setCursors(old=>Object.fromEntries(Object.entries(old).filter(([,c])=>Date.now()-c.received<(c.laser?1200:8000)))),600);return()=>{socket.off("studio:pointer",move);socket.off("cursor:left",leave);clearInterval(timer);};},[]);
 return <div className="studio-cursors">{Object.entries(cursors).filter(([,c])=>c.pageId===pageId).map(([id,c])=><div key={id} className={c.laser?"collab-laser":"collab-cursor"} style={{left:`${c.x/16}%`,top:`${c.y/9}%`,color:c.color}}>{!c.laser&&<><svg width="18" height="22" viewBox="0 0 18 22"><path d="M1 1v17l5-5h9z" fill="currentColor" stroke="white"/></svg><span style={{background:c.color}}>{c.name}</span></>}</div>)}</div>;
}
