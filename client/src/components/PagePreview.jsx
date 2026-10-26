import { useEffect,useRef } from "react";
import { drawPage,paintBackground } from "../lib/studioDraw.js";
export default function PagePreview({page}){
 const ref=useRef(null);
 useEffect(()=>{let alive=true;const draw=()=>{if(!alive||!ref.current)return;const ctx=ref.current.getContext("2d");ctx.save();ctx.scale(.16,.16);paintBackground(ctx,page.background);ctx.restore();
 const ink=document.createElement("canvas");ink.width=1600;ink.height=900;drawPage(ink.getContext("2d"),page,{onImageLoad:draw});ctx.drawImage(ink,0,0,256,144);};draw();return()=>{alive=false;};},[page]);
 return <canvas ref={ref} width="256" height="144" aria-hidden="true"/>;
}
