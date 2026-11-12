// Whiteboard — Igor Gomes ETI. GPL-3.0-or-later.
export const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
export function skeleton(input,w,h){
 const p=new Uint8Array(input);let changed=true,round=0;
 while(changed&&round++<60){changed=false;
  for(let phase=0;phase<2;phase++){
   const del=[];
   for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const i=y*w+x;if(!p[i])continue;
    const n=[p[i-w],p[i-w+1],p[i+1],p[i+w+1],p[i+w],p[i+w-1],p[i-1],p[i-w-1]];
    const count=n.reduce((a,b)=>a+b,0);if(count<2||count>6)continue;
    if(n.filter((v,k)=>!v&&n[(k+1)%8]).length!==1)continue;
    if(phase?(n[0]*n[2]*n[6]||n[0]*n[4]*n[6]):(n[0]*n[2]*n[4]||n[2]*n[4]*n[6]))continue;
    del.push(i);
   }
   for(const i of del)p[i]=0;if(del.length)changed=true;
  }
 }return p;
}
export function edgeMask(rgba,w,h,detail){
 const g=new Float32Array(w*h),out=new Uint8Array(w*h);
 for(let i=0;i<g.length;i++){const a=rgba[i*4+3]/255;g[i]=(rgba[i*4]*.299+rgba[i*4+1]*.587+rgba[i*4+2]*.114)*a+255*(1-a);}
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x,a=g[i-w-1],b=g[i-w],c=g[i-w+1],d=g[i-1],f=g[i+1],j=g[i+w-1],k=g[i+w],l=g[i+w+1];out[i]=+(Math.hypot(c+2*f+l-a-2*d-j,j+2*k+l-a-2*b-c)>4*detail);}
 return out;
}
export function tracePixels(mask,w,h,row=Infinity){
 const p=new Uint8Array(mask),paths=[];
 const neighbors=i=>{const x=i%w,y=i/w|0,r=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h&&p[yy*w+xx])r.push(yy*w+xx);}return r;};
 for(let i=0;i<p.length;i++)if(p[i]){
  const stack=[i];while(stack.length){let j=stack.pop();if(!p[j])continue;const path=[];
   while(j!==undefined&&p[j]){p[j]=0;path.push([j%w,j/w|0]);const n=neighbors(j);stack.push(...n.slice(1));j=n[0];}
   if(path.length===1)path.push([path[0][0]+.2,path[0][1]]);
   paths.push(path);
  }
 }
 paths.sort((a,b)=>Math.floor(a[0][1]/row)-Math.floor(b[0][1]/row)||a[0][0]-b[0][0]);return paths;
}
export function indexPaths(paths){
 let length=0;const segments=[];
 for(const path of paths)for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]);segments.push({a,b,start:length,end:length+d,first:i===1});length+=d;
 }return {segments,length};
}
export function strokeAt(index,p){const target=clamp(p,0,1)*index.length;let lo=0,hi=index.segments.length-1;while(lo<hi){const m=(lo+hi)>>1;if(index.segments[m].end<target)lo=m+1;else hi=m;}const s=index.segments[lo];if(!s)return null;const f=clamp((target-s.start)/(s.end-s.start||1),0,1);return {x:s.a[0]+f*(s.b[0]-s.a[0]),y:s.a[1]+f*(s.b[1]-s.a[1]),angle:Math.atan2(s.b[1]-s.a[1],s.b[0]-s.a[0])};}
export function drawStrokes(ctx,index,p){
 const target=clamp(p,0,1)*index.length;ctx.beginPath();
 for(const s of index.segments){if(s.start>target)break;const f=clamp((target-s.start)/(s.end-s.start||1),0,1);if(s.first)ctx.moveTo(...s.a);ctx.lineTo(s.a[0]+f*(s.b[0]-s.a[0]),s.a[1]+f*(s.b[1]-s.a[1]));if(f<1)break;}ctx.stroke();
}
export function hand(ctx,x,y,angle,skin,pen,scale=.8){
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.rotate(-.45+Math.sin(angle)*.15);
 const path=(d,fill)=>{const p=new Path2D(d);ctx.fillStyle=fill;ctx.fill(p);ctx.stroke(p);};
 ctx.strokeStyle='#4e372e80';ctx.lineWidth=1.25;
 ctx.translate(0,-45);path('M57 153 L26 100 Q14 88 12 63 L9 34 Q8 21 16 20 Q24 18 27 33 L31 49 L37 29 Q42 18 49 23 Q55 27 51 41 L47 57 L55 40 Q61 31 67 36 Q74 40 67 55 L63 68 Q76 59 81 68 Q89 85 76 101 L102 133 Z',skin);ctx.translate(0,45);
 if(pen==='eraser'){ctx.fillStyle='#96acbb';ctx.fillRect(-38,-21,76,30);ctx.strokeRect(-38,-21,76,30);}
 else if(pen!=='grip'){
  ctx.save();ctx.rotate(.18);
  if(pen==='quill')path('M0 0 Q0 -60 38 -106 Q65 -72 13 -10 Z','#ede6d7');
  else{path('M0 0 L-5 -18 L-5 -99 Q0 -107 5 -99 L5 -18 Z',({bic:'#d5b36b',three:'#e5edf3',fountain:'#182532',ink:'#333',ball:'#37688b'})[pen]||'#d5b36b');path('M0 0 L-4 -17 L4 -17 Z',pen==='fountain'?'#c6a259':'#383b40');ctx.fillStyle=pen==='bic'?'#2863a0':'#788896';ctx.fillRect(-5,-99,10,17);if(pen==='three')['#bc4949','#4780ca','#292e32'].forEach((c,k)=>{ctx.fillStyle=c;ctx.fillRect(-4+k*3,-98,2,13);});}
  ctx.restore();
 }
 ctx.translate(0,-45);path('M23 52 Q5 26 -2 21 Q-10 14 -14 23 Q-16 29 -6 39 L15 67 Q27 83 39 71 L46 53 Q48 43 41 40 Q34 37 30 51 L27 58 Z',skin);ctx.restore();
}
export const contentTime=s=>s.items.reduce((t,i)=>t+i.duration+i.pause,0)+s.hold;
export function timeline(scenes){let start=0;return scenes.map(scene=>{const duration=contentTime(scene)+({erase:1.2,fade:.5,cut:0})[scene.transition];const slot={scene,start,duration};start+=duration;return slot;});}
