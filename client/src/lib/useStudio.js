import { useEffect, useRef, useState, useCallback } from "react";
import { nanoid } from "nanoid";
import { socket } from "./socket.js";
import { optimisticAction } from "./studioDomain.js";

export function useStudio(boardId,user,onError) {
  const [view,setView]=useState(null),[saveStatus,setSaveStatus]=useState("connecting"),[users,setUsers]=useState([]);
  const base=useRef(null),pending=useRef([]),ready=useRef(false),sending=useRef(false),flushRef=useRef(null),errorRef=useRef(onError);
  useEffect(()=>{errorRef.current=onError;},[onError]);
  const key=`studio:pending:${boardId}`;
  const persist=useCallback(()=>{try{localStorage.setItem(key,JSON.stringify(pending.current));}catch{/* Memory still holds the queue if browser storage fills. */}},[key]);
  const render=useCallback(()=>{
    if(!base.current)return;
    let value=structuredClone(base.current);
    for(const action of pending.current)try{value=optimisticAction(value,action);}catch{/* Conflict is resolved against the server on acknowledgement. */}
    setView(value);persist();
    setSaveStatus(!socket.connected?"offline":pending.current.length?"saving":"saved");
  },[persist]);
  useEffect(()=>{
    base.current=null;ready.current=false;sending.current=false;
    try{pending.current=JSON.parse(localStorage.getItem(key)||"[]");if(!Array.isArray(pending.current))pending.current=[];}catch{pending.current=[];}
    let alive=true;
    function flush(){
      if(!alive||!ready.current||sending.current||!pending.current.length||!socket.connected)return;
      sending.current=true;const action=pending.current[0];
      socket.timeout(12000).emit("studio:action",action,(error,result)=>{
        sending.current=false;if(!alive)return;
        if(error){setSaveStatus("offline");ready.current=false;socket.disconnect();socket.connect();return;}
        if(result.state && (!base.current||result.state.revision>=base.current.revision))base.current=result.state;
        pending.current=pending.current.filter(a=>a.id!==action.id);
        if(!result.ok)errorRef.current(result.error||"Could not save this edit");
        render();flush();
      });
    }
    flushRef.current=flush;
    function join(){ready.current=false;socket.emit("board:join",{boardId,user});}
    function open(){socket.timeout(15000).emit("studio:open",{boardId},(error,result)=>{
      if(!alive)return;
      if(error||!result?.ok){setSaveStatus("error");errorRef.current(result?.error||"Could not load workspace. Reconnect to retry.");return;}
      base.current=result.state;pending.current=pending.current.filter(a=>!result.state.receipts.includes(a.id));ready.current=true;render();flush();
    });}
    function changed({state}){
      if(!base.current||state.revision>=base.current.revision){base.current=state;pending.current=pending.current.filter(a=>!state.receipts.includes(a.id));render();}
    }
    function disconnected(){ready.current=false;sending.current=false;setSaveStatus("offline");}
    function presence({users}){setUsers(users);}
    function onError({message}){errorRef.current(message);}
    function hide(){socket.disconnect();}function show(e){if(e.persisted)socket.connect();}
    socket.on("connect",join);socket.on("board:state",open);socket.on("studio:changed",changed);socket.on("disconnect",disconnected);socket.on("presence:update",presence);socket.on("error:message",onError);
    window.addEventListener("pagehide",hide);window.addEventListener("pageshow",show);
    if(socket.connected)join();else socket.connect();
    return()=>{alive=false;ready.current=false;socket.off("connect",join);socket.off("board:state",open);socket.off("studio:changed",changed);socket.off("disconnect",disconnected);socket.off("presence:update",presence);socket.off("error:message",onError);window.removeEventListener("pagehide",hide);window.removeEventListener("pageshow",show);socket.disconnect();};
  },[boardId,user,key,render]);
  function dispatch(action){
    if(!base.current){errorRef.current("Wait for the workspace to load.");return null;}
    if(pending.current.length>=100){errorRef.current("Reconnect to save your pending edits before adding more.");return null;}
    const full={...action,id:"act_"+nanoid(12)};
    try{let state=structuredClone(base.current);for(const a of pending.current)state=optimisticAction(state,a);optimisticAction(state,full);}catch(e){errorRef.current(e.message);return null;}
    pending.current.push(full);render();flushRef.current?.();return full;
  }
  return {view,dispatch,saveStatus,users};
}
