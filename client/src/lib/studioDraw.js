import { API_URL } from "./api.js";
export const SERVER_URL = API_URL;
const images = new Map();
export function getImage(assetId, onLoad) {
  if (!images.has(assetId)) {
    const image = new Image(); image.crossOrigin = "use-credentials";
    const entry = { image, callbacks: new Set() }; images.set(assetId, entry);
    image.onload = () => { entry.callbacks.forEach(fn => fn()); entry.callbacks.clear(); };
    image.onerror = () => { entry.failed = true; entry.callbacks.forEach(fn => fn()); entry.callbacks.clear(); };
    image.src = `${SERVER_URL}/api/assets/${assetId}`;
  }
  const entry = images.get(assetId);
  if (onLoad && !entry.image.complete) entry.callbacks.add(onLoad);
  return entry.image;
}
function textLines(ctx, text, width) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line ? line + " " + word : word;
      if (ctx.measureText(candidate).width > width && line) { lines.push(line); line = word; }
      else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}
export function drawObject(ctx, el, onImageLoad) {
  ctx.save(); ctx.strokeStyle = el.color; ctx.fillStyle = el.color;
  ctx.lineWidth = el.size; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.globalAlpha = el.opacity ?? (el.tool === "highlighter" ? 0.27 : 1);
  if (el.type === "stroke") {
    if (el.tool === "eraser") ctx.globalCompositeOperation = "destination-out";
    const points = el.points;
    if (points.length === 1) { ctx.beginPath(); ctx.arc(...points[0], el.size/2, 0, Math.PI*2); ctx.fill(); }
    else if (el.pressures?.length && el.tool === "pen") {
      for (let i=1;i<points.length;i++) { ctx.lineWidth = el.size * (0.35 + (el.pressures[i] || .5)*1.3); ctx.beginPath(); ctx.moveTo(...points[i-1]); ctx.lineTo(...points[i]); ctx.stroke(); }
    } else {
      ctx.beginPath(); ctx.moveTo(...points[0]);
      for (let i=1;i<points.length-1;i++) ctx.quadraticCurveTo(...points[i], (points[i][0]+points[i+1][0])/2, (points[i][1]+points[i+1][1])/2);
      ctx.lineTo(...points[points.length-1]); ctx.stroke();
    }
  } else if (el.type === "rect") { if (el.fill) { ctx.fillStyle=el.fill;ctx.fillRect(el.x,el.y,el.width,el.height); } ctx.strokeRect(el.x,el.y,el.width,el.height); }
  else if (el.type === "circle") { ctx.beginPath();ctx.arc(el.cx,el.cy,el.r,0,Math.PI*2);if(el.fill){ctx.fillStyle=el.fill;ctx.fill();}ctx.stroke(); }
  else if (["line","arrow"].includes(el.type)) {
    ctx.beginPath();ctx.moveTo(el.x1,el.y1);ctx.lineTo(el.x2,el.y2);ctx.stroke();
    if(el.type==="arrow") { const a=Math.atan2(el.y2-el.y1,el.x2-el.x1),len=Math.max(18,el.size*4);ctx.beginPath();ctx.moveTo(el.x2-len*Math.cos(a-.45),el.y2-len*Math.sin(a-.45));ctx.lineTo(el.x2,el.y2);ctx.lineTo(el.x2-len*Math.cos(a+.45),el.y2-len*Math.sin(a+.45));ctx.stroke(); }
  } else if (el.type === "image") {
    const image = getImage(el.assetId,onImageLoad);
    if (image.complete && image.naturalWidth) ctx.drawImage(image,el.x,el.y,el.width,el.height);
    else { ctx.fillStyle="#edf0f5";ctx.fillRect(el.x,el.y,el.width,el.height);ctx.fillStyle="#7b8194";ctx.font="20px sans-serif";ctx.fillText(image.complete ? "Image unavailable" : "Loading image…",el.x+20,el.y+35); }
  } else if (["text","note"].includes(el.type)) {
    if(el.type==="note"){ctx.fillStyle=el.fill||"#fff1a8";ctx.shadowColor="#00000012";ctx.shadowBlur=12;ctx.shadowOffsetY=4;ctx.fillRect(el.x,el.y,el.width,el.height);ctx.shadowColor="transparent";}
    const pad=el.type==="note"?24:4;
    ctx.font=`${el.bold?700:400} ${el.fontSize}px "Inter", "Segoe UI", sans-serif`;
    ctx.fillStyle=el.color;ctx.textBaseline="top";ctx.textAlign=el.align||"left";
    const x=el.align==="center"?el.x+el.width/2:el.align==="right"?el.x+el.width-pad:el.x+pad;
    // Clip text to its object: resizing is predictable and cannot paint over UI.
    ctx.beginPath();ctx.rect(el.x,el.y,el.width,el.height);ctx.clip();
    textLines(ctx,el.text,el.width-pad*2).forEach((line,i)=>ctx.fillText(line,x,el.y+pad+i*el.fontSize*1.35));
  }
  ctx.restore();
}
const inkSurfaces = new WeakMap();
export function drawPage(ctx, page, { hideInk=false, onImageLoad }={}) {
  ctx.clearRect(0,0,1600,900);
  if (!page) return;
  // Erasing annotations must not cut holes in a reference photograph.
  for (const el of page.elements) if(el.layer==="base") drawObject(ctx,el,onImageLoad);
  if(hideInk)return;
  if(!inkSurfaces.has(ctx)){const c=document.createElement("canvas");c.width=1600;c.height=900;inkSurfaces.set(ctx,c);}
  const ink=inkSurfaces.get(ctx), iCtx=ink.getContext("2d");iCtx.clearRect(0,0,1600,900);
  for(const el of page.elements)if(el.layer!=="base")drawObject(iCtx,el,onImageLoad);
  ctx.drawImage(ink,0,0);
}
export function paintBackground(ctx, bg) {
  ctx.fillStyle=bg==="dark"?"#202534":"#ffffff";ctx.fillRect(0,0,1600,900);
  if(bg==="plain"||bg==="dark")return;
  ctx.strokeStyle="#e9ecf3";ctx.fillStyle="#d9deeb";ctx.lineWidth=1;
  if(bg==="dots")for(let x=24;x<1600;x+=24)for(let y=24;y<900;y+=24){ctx.beginPath();ctx.arc(x,y,1,0,Math.PI*2);ctx.fill();}
  else for(let n=0;n<1600;n+=40){ctx.beginPath();if(bg==="grid"){ctx.moveTo(n,0);ctx.lineTo(n,900);}if(n<900){ctx.moveTo(0,n);ctx.lineTo(1600,n);}ctx.stroke();}
}
export async function exportPage(page) {
  await Promise.all(page.elements.filter(e=>e.type==="image").map(e=>new Promise(resolve=>{ const img=getImage(e.assetId,resolve);if(img.complete)resolve(); })));
  const ink=document.createElement("canvas");ink.width=1600;ink.height=900;drawPage(ink.getContext("2d"),page);
  const c=document.createElement("canvas");c.width=1600;c.height=900;const ctx=c.getContext("2d");paintBackground(ctx,page.background);ctx.drawImage(ink,0,0);
  return c.toDataURL("image/png");
}
export async function uploadImage(file,boardId) {
  if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw new Error("Use a PNG, JPEG or WebP image.");
  if(file.size>15_000_000)throw new Error("Choose an image smaller than 15 MB.");
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
  const c=document.createElement("canvas");c.width=Math.round(bitmap.width*scale);c.height=Math.round(bitmap.height*scale);c.getContext("2d").drawImage(bitmap,0,0,c.width,c.height);bitmap.close();
  const blob=await new Promise(resolve=>c.toBlob(resolve,"image/webp",.8));
  if(!blob||blob.size>900_000)throw new Error("This image is too detailed. Try a smaller image.");
  const res=await fetch(`${SERVER_URL}/api/assets/${boardId}`,{method:"POST",credentials:"include",headers:{"Content-Type":"image/webp"},body:blob});
  const result=await res.json();if(!res.ok)throw new Error(result.error||"Upload failed");
  return {...result,width:c.width,height:c.height};
}
