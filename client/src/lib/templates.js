import { nanoid } from "nanoid";
export function templateObjects(type,userId) {
  const base={color:"#24334b",size:2,createdBy:userId,createdAt:Date.now(),layer:"ink"};
  const text=(label,x,y,width=500,fontSize=36)=>({...base,id:"el_"+nanoid(10),type:"text",x,y,width,height:100,text:label,fontSize,bold:true});
  const note=(label,x,y,fill)=>({...base,id:"el_"+nanoid(10),type:"note",x,y,width:360,height:230,text:label,fontSize:26,fill});
  const rect=(x,y,width,height,fill)=>({...base,id:"el_"+nanoid(10),type:"rect",x,y,width,height,fill,color:"#d8dfeb"});
  if(type==="brainstorm")return [text("A place for your next big idea.",90,65,1350,48),text("Start with a question. Add ideas. Find connections.",90,140,1350,24),note("What if…",100,280,"#fff1a8"),note("The problem",620,280,"#e4dbff"),note("A possible solution",1140,280,"#ccf2e3"),text("Drag a note. Double-click to make it yours.",90,750,1400,24)];
  if(type==="kanban")return [text("From idea to done.",80,60,1400,48),...[["TO DO",80,"#f4f0ff"],["IN PROGRESS",580,"#eef4ff"],["DONE",1080,"#edf9f3"]].flatMap(([label,x,fill])=>[rect(x,180,440,640,fill),text(label,x+28,210,380,24)]),note("Your first task",120,310,"#fff1a8")];
  if(type==="compare")return [text("Two perspectives. One clear decision.",90,60,1400,44),rect(90,200,680,580,"#f1edff"),rect(830,200,680,580,"#edf7f3"),text("Option A",120,230,600),text("Option B",860,230,600),text("Strengths, risks, and questions…",120,310,580,24),text("Strengths, risks, and questions…",860,310,580,24)];
  if(type==="story")return [text("Tell it in four frames.",90,60,1400,48),...[[90,210],[830,210],[90,540],[830,540]].flatMap(([x,y],i)=>[rect(x,y,680,280,"#f8f9fc"),text(`0${i+1}  ${["The problem","The idea","How it works","The impact"][i]}`,x+25,y+24,620,28)])];
  return [];
}
