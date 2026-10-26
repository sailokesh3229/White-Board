import {useRef,useEffect,useState,useLayoutEffect} from "react";
import {nanoid} from "nanoid";
import {drawPage,drawObject} from "../lib/studioDraw.js";
import {bounds,hitObject,transformObject} from "../lib/studioGeometry.js";
import StudioCursors from "./StudioCursors.jsx";
import {socket} from "../lib/socket.js";

export default function StudioCanvas({page,tool,color,size,fontSize,fill,userId,onObjects,selection,onSelection,zoom,onZoom,hideInk,penOnly,present,onNext,onPrev,onUpload}){
 const main=useRef(null),preview=useRef(null),viewport=useRef(null),gesture=useRef(null),pageRef=useRef(page),raf=useRef(null);
 useEffect(()=>{pageRef.current=page;},[page]);
 const [fit,setFit]=useState(.6),[pan,setPan]=useState({x:0,y:0}),[edit,setEdit]=useState(null),[draftBox,setDraftBox]=useState(null),[laser,setLaser]=useState(null);
 useLayoutEffect(()=>{const node=viewport.current;const observer=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;setFit(Math.max(.1,Math.min((width-64)/1600,(height-70)/900)));});observer.observe(node);return()=>observer.disconnect();},[]);
 useEffect(()=>{const node=viewport.current;function wheel(e){e.preventDefault();if(e.ctrlKey||e.metaKey)onZoom(z=>Math.min(3,Math.max(.35,z*(e.deltaY>0?.9:1.1))));else setPan(p=>({x:p.x-e.deltaX,y:p.y-e.deltaY}));}node.addEventListener("wheel",wheel,{passive:false});return()=>node.removeEventListener("wheel",wheel);},[onZoom]);
 useEffect(()=>{let alive=true;function draw(){if(alive&&main.current)drawPage(main.current.getContext("2d"),page,{hideInk,onImageLoad:draw});}draw();return()=>{alive=false;};},[page,hideInk]);
 useEffect(()=>()=>{if(raf.current)cancelAnimationFrame(raf.current);},[]);
 function point(e){const b=preview.current.getBoundingClientRect();return [Math.round(Math.max(-80,Math.min(1680,(e.clientX-b.left)/b.width*1600))*10)/10,Math.round(Math.max(-80,Math.min(980,(e.clientY-b.top)/b.height*900))*10)/10];}
 function blank(fields){return {id:"el_"+nanoid(10),color,size,createdAt:Date.now(),createdBy:userId,layer:"ink",...fields};}
 const selected=page.elements.filter(e=>selection.includes(e.id));
 const groupBounds=()=>{if(!selected.length)return null;const boxes=selected.map(bounds),x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));return {x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};};
 const selBox=draftBox||groupBounds();
 function shape(g,end){const [x,y]=g.start,[ex,ey]=end; if(g.tool==="rect")return {...g.el,x:Math.min(x,ex),y:Math.min(y,ey),width:Math.max(5,Math.abs(ex-x)),height:Math.max(5,Math.abs(ey-y))};if(g.tool==="circle")return {...g.el,cx:x,cy:y,r:Math.max(1,Math.hypot(ex-x,ey-y))};return {...g.el,x1:x,y1:y,x2:ex,y2:ey};}
 function drawPreview(g,end){const ctx=preview.current.getContext("2d");ctx.clearRect(0,0,1600,900);if(g.kind==="draw")drawObject(ctx,g.el.type==="stroke"?g.el:shape(g,end));else if(g.kind==="transform")for(const el of g.transformed||[])drawObject(ctx,el);else if(g.kind==="lasso"){ctx.strokeStyle="#7562ed";ctx.setLineDash([8,5]);ctx.fillStyle="#7562ed12";const b={x:Math.min(g.start[0],end[0]),y:Math.min(g.start[1],end[1]),width:Math.abs(end[0]-g.start[0]),height:Math.abs(end[1]-g.start[1])};ctx.fillRect(b.x,b.y,b.width,b.height);ctx.strokeRect(b.x,b.y,b.width,b.height);ctx.setLineDash([]);}}
 function down(e){
   if(gesture.current||edit)return;
   if(e.button!==0&&e.button!==1)return;
   if(penOnly&&e.pointerType==="touch"){gesture.current={kind:"pan",id:e.pointerId,client:[e.clientX,e.clientY],pan};e.currentTarget.setPointerCapture(e.pointerId);return;}
   const p=point(e);e.currentTarget.setPointerCapture(e.pointerId);
   if(tool==="hand"||e.button===1){gesture.current={kind:"pan",id:e.pointerId,client:[e.clientX,e.clientY],pan};return;}
   if(tool==="laser"||present){setLaser(p);gesture.current={kind:"laser",id:e.pointerId};return;}
   if(tool==="select"){
     const b=groupBounds();
     const resize=b&&Math.hypot(p[0]-(b.x+b.width),p[1]-(b.y+b.height))<22/zoom;
     const hit=[...page.elements].reverse().find(el=>hitObject(el,p));
     const ids=resize?selection:e.shiftKey&&hit?(selection.includes(hit.id)?selection.filter(id=>id!==hit.id):[...selection,hit.id]):hit?(selection.includes(hit.id)?selection:[hit.id]):[];
     onSelection(ids);
     const objects=page.elements.filter(el=>ids.includes(el.id)&&!el.locked);
     if(objects.length){gesture.current={kind:"transform",id:e.pointerId,start:p,objects,resize,box:b,transformed:objects};drawPage(main.current.getContext("2d"),{...page,elements:page.elements.filter(el=>!objects.some(o=>o.id===el.id))},{hideInk});drawPreview(gesture.current,p);}
     else gesture.current={kind:"lasso",id:e.pointerId,start:p};return;
   }
   onSelection([]);
   if(tool==="text"||tool==="note"){gesture.current={kind:"edit",id:e.pointerId,object:blank({type:tool,x:Math.min(p[0],1250),y:Math.min(p[1],700),width:tool==="note"?320:500,height:tool==="note"?240:160,text:"",fontSize,bold:false,fill:tool==="note"?(fill||"#fff1a8"):undefined})};return;}
   const stroke=["pen","highlighter","eraser"].includes(tool);
   gesture.current={kind:"draw",id:e.pointerId,start:p,tool,el:blank(stroke?{type:"stroke",tool,points:[p],size:tool==="highlighter"?Math.max(20,size*4):size,opacity:tool==="highlighter"?.27:1,...(e.pointerType==="pen"?{pressures:[e.pressure||.5]}:{})}:{type:tool,...(fill?{fill}:{})})};
   if(stroke&&tool==="highlighter")gesture.current.el.size=Math.min(40,gesture.current.el.size);
   drawPreview(gesture.current,p);
 }
 function move(e){const p=point(e);onCursor(p,tool==="laser"||present);
   const g=gesture.current;if(!g||g.id!==e.pointerId)return;
   if(g.kind==="pan"){setPan({x:g.pan.x+e.clientX-g.client[0],y:g.pan.y+e.clientY-g.client[1]});return;}
   if(g.kind==="laser"){setLaser(p);return;}
   if(g.kind==="draw"&&g.el.type==="stroke"){
     const previous=g.el.points.at(-1);if(Math.hypot(p[0]-previous[0],p[1]-previous[1])<.7)return;
     g.el.points.push(p);if(g.el.pressures)g.el.pressures.push(e.pressure||.5);
     if(g.el.points.length>=4900){onObjects([g.el]);g.el={...g.el,id:"el_"+nanoid(10),points:[p],...(g.el.pressures?{pressures:[e.pressure||.5]}:{})};}
   }
   if(g.kind==="transform"){
     const dx=p[0]-g.start[0],dy=p[1]-g.start[1];
     if(g.resize&&g.box){const target={...g.box,width:Math.max(25,g.box.width+dx),height:Math.max(25,g.box.height+dy)};if(e.shiftKey)target.height=target.width*g.box.height/Math.max(1,g.box.width);g.transformed=g.objects.map(el=>{const b=bounds(el),sx=target.width/Math.max(1,g.box.width),sy=target.height/Math.max(1,g.box.height);return transformObject(el,{x:target.x+(b.x-g.box.x)*sx,y:target.y+(b.y-g.box.y)*sy,width:Math.max(5,b.width*sx),height:Math.max(5,b.height*sy)});});setDraftBox(target);}
     else {g.transformed=g.objects.map(el=>{const b=bounds(el);return transformObject(el,{...b,x:b.x+dx,y:b.y+dy});});if(g.box)setDraftBox({...g.box,x:g.box.x+dx,y:g.box.y+dy});}
   }
   if(raf.current)cancelAnimationFrame(raf.current);raf.current=requestAnimationFrame(()=>drawPreview(g,p));
 }
 // Cursor positions are volatile and throttled separately from drawing edits.
 const lastCursor=useRef(0);
 function onCursor(p,laser){if(Date.now()-lastCursor.current<50)return;lastCursor.current=Date.now();socket.volatile.emit("studio:pointer",{x:p[0],y:p[1],pageId:page.id,laser});}
 function up(e){const g=gesture.current;if(!g||g.id!==e.pointerId)return;gesture.current=null;if(raf.current)cancelAnimationFrame(raf.current);const p=point(e);preview.current.getContext("2d").clearRect(0,0,1600,900);setDraftBox(null);
   if(g.kind==="draw"){const el=g.el.type==="stroke"?g.el:shape(g,p);if(el.type==="stroke"||Math.hypot(p[0]-g.start[0],p[1]-g.start[1])>4)onObjects([el]);}
   else if(g.kind==="edit")setEdit({object:g.object,fresh:true});
   else if(g.kind==="transform"){if(Math.hypot(p[0]-g.start[0],p[1]-g.start[1])>1)onObjects(g.transformed);drawPage(main.current.getContext("2d"),pageRef.current,{hideInk});}
   else if(g.kind==="lasso"){const x=Math.min(g.start[0],p[0]),y=Math.min(g.start[1],p[1]),w=Math.abs(g.start[0]-p[0]),h=Math.abs(g.start[1]-p[1]);if(w>5||h>5)onSelection(page.elements.filter(el=>{const b=bounds(el);return b.x>=x&&b.y>=y&&b.x+b.width<=x+w&&b.y+b.height<=y+h;}).map(el=>el.id));}
   if(g.kind==="laser")setLaser(null);
 }
 function saveText(){if(!edit)return;if(edit.object.text.trim())onObjects([edit.object]);setEdit(null);}
 function doubleClick(e){const hit=[...page.elements].reverse().find(el=>["text","note"].includes(el.type)&&!el.locked&&hitObject(el,point(e)));if(hit)setEdit({object:{...hit},fresh:false});}
 return <div ref={viewport} className={`stage-viewport ${present?"presenting":""}`} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(e.dataTransfer.files[0])onUpload(e.dataTransfer.files[0]);}}>
   <div className={`paper-shell paper-${page.background}`} style={{width:1600*fit*zoom,height:900*fit*zoom,transform:`translate(-50%,-50%) translate(${pan.x}px,${pan.y}px)`}}>
     <canvas ref={main} className="studio-main" width="1600" height="900"/>
     <canvas ref={preview} className={`studio-input cursor-${tool}`} width="1600" height="900" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDoubleClick={doubleClick}/>
     {selBox&&tool==="select"&&!edit&&<div className="selection-box" style={{left:`${selBox.x/16}%`,top:`${selBox.y/9}%`,width:`${selBox.width/16}%`,height:`${selBox.height/9}%`}}><i/><i/><i/><i/></div>}
     {edit&&<textarea key={edit.object.id} className="canvas-text-editor" aria-label="Edit text" autoFocus value={edit.object.text} placeholder={edit.object.type==="note"?"Your idea goes here…":"Type something…"} style={{left:`${edit.object.x/16}%`,top:`${edit.object.y/9}%`,width:`${edit.object.width/16}%`,height:`${edit.object.height/9}%`,fontSize:edit.object.fontSize*fit*zoom,color:edit.object.color,background:edit.object.type==="note"?edit.object.fill:"#ffffffed",fontWeight:edit.object.bold?700:400}} onChange={e=>setEdit({...edit,object:{...edit.object,text:e.target.value.slice(0,4000)}})} onBlur={saveText} onKeyDown={e=>{e.stopPropagation();if(e.key==="Escape")setEdit(null);if(e.key==="Enter"&&(e.ctrlKey||e.metaKey))saveText();}}/>}
     <StudioCursors pageId={page.id}/>{laser&&<div className="local-laser" style={{left:`${laser[0]/16}%`,top:`${laser[1]/9}%`}}/>}
   </div>
   {!page.elements.length&&!edit&&<div className="canvas-empty-hint"><span>A little space for a big idea.</span><small>Draw, drop an image, or press T to add text.</small></div>}
   <div className="stage-label">{page.name} <span>1600 × 900</span></div>
   <button className="fit-canvas" onClick={()=>{setPan({x:0,y:0});onZoom(1);}}>Fit to screen</button>
   {present&&<div className="presentation-controls"><button onClick={onPrev}>← Previous</button><span>{page.name}</span><button onClick={onNext}>Next →</button></div>}
 </div>;
}
