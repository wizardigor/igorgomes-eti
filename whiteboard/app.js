import {voiceStyles,voiceChain} from './voice-effects.js';
import {fonts,shapes,effects,cropRect,entrance} from './editor-options.js';
import {handModel,loadHand,drawWritingHand} from './hand-sprites.js';
import {clamp,drawStrokes,strokeAt,hand,timeline,contentTime} from './engine.js';
const $=id=>document.getElementById(id),board=$('board'),ctx=board.getContext('2d');
const uid=()=>crypto.randomUUID(),say=s=>$('notice').textContent=s;
const itemBase=(type='text')=>({id:uid(),type,text:'Sua ideia começa aqui.',x:100,y:100,width:700,font:'hand',fontSize:58,color:'#102d50',rotation:0,flipX:false,flipY:false,duration:4,pause:.5,effect:'draw',detail:34,shape:'bulb',crop:[0,0,1,1],src:''});
const sceneBase=(name='Nova cena')=>({id:uid(),name,items:[],hold:1,transition:'erase',audio:null,narration:'',voice:'m1',speed:160,pitch:50,gap:0,volume:1,offset:0,voiceStyle:'clean',bass:0,mids:0,treble:0});
const first=sceneBase('Uma ideia ganha vida');
first.items=[{...itemBase(),text:'Uma ideia ganha vida.'},{...itemBase(),text:'Conte a sua história.',x:150,y:245,fontSize:42,color:'#447765',duration:3}];
let project={version:1,name:'Minha primeira história',aspect:'landscape',background:'#ffffff',skin:'#c98e68',pen:'bic',hand:true,handModel:'masculina',scenes:[first]};
let sceneId=first.id,itemId=first.items[0].id,t=0,edit=true,undo=[],redo=[],run=null,revision=0,writeTimer,drag;
const scene=()=>project.scenes.find(s=>s.id===sceneId)||project.scenes[0],item=()=>scene().items.find(i=>i.id===itemId);
const sizes={landscape:[960,540],portrait:[540,960],square:[720,720]},slots=()=>timeline(project.scenes),duration=()=>slots().reduce((n,s)=>n+s.duration,0);
const stamp=x=>Math.floor(x/60)+':'+String(Math.floor(x%60)).padStart(2,'0');
const storage=()=>new Promise((res,rej)=>{const r=indexedDB.open('igor-whiteboard',1);r.onupgradeneeded=()=>r.result.createObjectStore('draft');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
async function draft(write){const db=await storage();try{return await new Promise((res,rej)=>{const tx=db.transaction('draft',write?'readwrite':'readonly'),obj=tx.objectStore('draft'),q=write?obj.put(project,'current'):obj.get('current');tx.oncomplete=()=>res(q.result);tx.onerror=()=>rej(tx.error);});}finally{db.close();}}
function schedule(){clearTimeout(writeTimer);writeTimer=setTimeout(()=>draft(true).catch(()=>say('Não foi possível salvar o rascunho. Use Salvar projeto.')),350);}
function snapshot(){undo.push(structuredClone(project));if(undo.length>20)undo.shift();redo=[];}
function change(fn){if(run)return;snapshot();fn();t=clamp(t,0,duration());edit=true;schedule();refresh();}
const projectFields={name:'name',aspect:'aspect','board-color':'background',skin:'skin',pen:'pen','hand-model':'handModel'};
const sceneFields={hold:'hold',transition:'transition',volume:'volume',offset:'offset',narration:'narration',voice:'voice',speed:'speed',pitch:'pitch',gap:'gap','voice-style':'voiceStyle','eq-bass':'bass','eq-mids':'mids','eq-treble':'treble'};
const itemFields={text:'text',effect:'effect','shape-kind':'shape',font:'font','font-size':'fontSize',ink:'color',duration:'duration',pause:'pause',x:'x',y:'y',width:'width',rotation:'rotation',detail:'detail'};
const caches=new WeakMap();let tracer;const waiting=new Map(),audioCache=new Map();
const key=i=>[i.type,i.text,i.font,i.fontSize,i.color,i.detail,i.effect,i.shape,...i.crop,i.src].join('|');
function raster(i){
 const c=document.createElement('canvas'),g=c.getContext('2d');
 if(i.type==='image')return new Promise((res,rej)=>{const img=new Image();img.onload=()=>{const [x,y,w,h]=i.crop,[iw,ih]=[img.naturalWidth,img.naturalHeight],q=Math.min(1,520/Math.max(iw*w,ih*h));c.width=Math.max(1,Math.round(iw*w*q));c.height=Math.max(1,Math.round(ih*h*q));g.drawImage(img,x*iw,y*ih,w*iw,h*ih,0,0,c.width,c.height);res(c);};img.onerror=()=>rej(Error('Imagem inválida.'));img.src=i.src;});
 if(i.type==='shape'){
  c.width=320;c.height=290;g.strokeStyle=i.color;g.lineWidth=8;g.lineCap='round';g.lineJoin='round';
  const p=new Path2D(shapes[i.shape]||shapes.bulb);
  g.stroke(p);return c;
 }
 const font=i.fontSize+'px '+fonts[i.font],lineHeight=Math.ceil(i.fontSize*1.35),lines=[];
 g.font=font;
 for(const para of i.text.split('\n')){let line='';for(const word of para.split(/\s+/)){const next=line?line+' '+word:word;if(line&&g.measureText(next).width>612){lines.push(line);line=word;}else line=next;}lines.push(line);}
 c.width=640;c.height=Math.max(38,Math.min(1350,lines.length*lineHeight+16));g.font=font;g.textBaseline='top';g.fillStyle=i.color;lines.forEach((line,n)=>g.fillText(line,10,8+n*lineHeight,620));return c;
}
async function trace(canvas,i){
 if(!tracer){tracer=new Worker(new URL('./trace-worker.js',import.meta.url),{type:'module'});tracer.onmessage=({data})=>{const cb=waiting.get(data.id);if(cb)cb(data);};tracer.onerror=()=>{for(const cb of waiting.values())cb({error:'Não foi possível calcular os traços.'});tracer.terminate();tracer=null;};}
 const w=canvas.width,h=canvas.height,pixels=canvas.getContext('2d').getImageData(0,0,w,h).data,id=uid();
 return new Promise((res,rej)=>{const timer=setTimeout(()=>{waiting.delete(id);rej(Error('Traçado demorou demais. Tente uma imagem menor.'));},30000);waiting.set(id,d=>{clearTimeout(timer);waiting.delete(id);d.error?rej(Error(d.error)):res(d.index);});tracer.postMessage({id,w,h,pixels,detail:i.type==='image'?i.detail:null,row:i.type==='text'?Math.ceil(i.fontSize*1.35):Infinity},[pixels.buffer]);});
}
async function prepare(i){
 const k=key(i),old=caches.get(i);if(old?.key===k)return old.promise;
 const entry={key:k,promise:null,result:null};entry.promise=(async()=>{if(i.type==='text'&&['gothic','trash','terror'].includes(i.font))await document.fonts.load(i.fontSize+'px "'+fonts[i.font]+'"');const bmp=await raster(i),index=i.effect==='draw'?await trace(bmp,i):null;return entry.result={bmp,index};})().catch(e=>{if(caches.get(i)===entry)caches.delete(i);throw e;});caches.set(i,entry);return entry.promise;
}
function drawItem(i,p,withHand,side=1){
 const cache=caches.get(i)?.result;if(!cache||p<=0)return;
 const {bmp,index}=cache,scale=i.width/bmp.width,h=bmp.height*scale;
 const [dx,dy]=entrance(i.effect,i.effect==='slide'?Math.min(1,p/.78):p,side,board.width+i.width+220,board.height+h);
 ctx.save();ctx.translate(dx+i.x+i.width/2,dy+i.y+h/2);ctx.rotate(i.rotation*Math.PI/180);ctx.translate(-i.width/2,-h/2);ctx.scale(scale,scale);
 if(i.flipX||i.flipY){ctx.translate(i.flipX?bmp.width:0,i.flipY?bmp.height:0);ctx.scale(i.flipX?-1:1,i.flipY?-1:1);}
 if(i.effect!=='draw'||p>=1){
  if(i.effect==='fade')ctx.globalAlpha=p;
  ctx.drawImage(bmp,0,0);
  if(i.effect==='slide'&&p<1&&withHand){
   if(i.flipX||i.flipY){ctx.scale(i.flipX?-1:1,i.flipY?-1:1);ctx.translate(i.flipX?-bmp.width:0,i.flipY?-bmp.height:0);}
   const leave=clamp((p-.78)/.22,0,1)**2*(board.width+220)/scale;
   drawWritingHand(ctx,bmp.width*(side>0?.84:.16)+side*leave,bmp.height*.29,0,project.handModel,scale,'grip',side);
  }
 }
 else{const progress=clamp(p/.92,0,1);ctx.strokeStyle=i.color;ctx.lineWidth=i.type==='text'?Math.max(2,i.fontSize/14):2;ctx.lineJoin=ctx.lineCap='round';drawStrokes(ctx,index,progress);
  if(p>.92){ctx.globalAlpha=(p-.92)/.08;ctx.drawImage(bmp,0,0);ctx.globalAlpha=1;}const tip=strokeAt(index,progress);if(withHand&&tip){
  if(i.flipX||i.flipY){ctx.scale(i.flipX?-1:1,i.flipY?-1:1);ctx.translate(i.flipX?-bmp.width:0,i.flipY?-bmp.height:0);}
  const x=i.flipX?bmp.width-tip.x:tip.x,y=i.flipY?bmp.height-tip.y:tip.y;
  const a=Math.atan2((i.flipY?-1:1)*Math.sin(tip.angle),(i.flipX?-1:1)*Math.cos(tip.angle));
  if(!drawWritingHand(ctx,x,y,a,project.handModel,scale,project.pen))hand(ctx,x,y,a,project.skin,project.pen,.82/scale);
  }
 }
 ctx.restore();
}
function paint(){
 const list=slots(),slot=list.find(x=>t>=x.start&&t<x.start+x.duration)||list.at(-1),s=edit?scene():slot.scene,local=t-slot.start;ctx.fillStyle=project.background;ctx.fillRect(0,0,board.width,board.height);
 let offset=0,pasted=0;for(const i of s.items){const side=i.effect==='slide'&&pasted++%2?-1:1;drawItem(i,edit?1:clamp((local-offset)/i.duration,0,1),!edit&&project.hand,side);offset+=i.duration+i.pause;}
 const tail=local-contentTime(s);
 if(!edit&&tail>0&&s.transition==='fade'){ctx.globalAlpha=clamp(tail/.5,0,1);ctx.fillStyle=project.background;ctx.fillRect(0,0,board.width,board.height);ctx.globalAlpha=1;}
 if(!edit&&tail>0&&s.transition==='erase'){const step=clamp(tail/1.2,0,1)*5,b=board.height/5;ctx.fillStyle=project.background;for(let n=0;n<5;n++){const w=clamp(step-n,0,1)*board.width;ctx.fillRect(n%2?board.width-w:0,n*b,w,b+1);}if(project.hand&&step<5){const n=Math.floor(step),q=step-n;const x=board.width*(n%2?1-q:q),y=(n+.5)*b;if(!drawWritingHand(ctx,x,y,0,project.handModel,1,'eraser'))hand(ctx,x,y,0,project.skin,'eraser');}}
 const i=item(),bmp=i&&caches.get(i)?.result?.bmp;if(edit&&bmp&&!$('full-dialog').open){const h=i.width*bmp.height/bmp.width;ctx.save();ctx.translate(i.x+i.width/2,i.y+h/2);ctx.rotate(i.rotation*Math.PI/180);ctx.setLineDash([6,4]);ctx.strokeStyle='#659a85';ctx.strokeRect(-i.width/2,-h/2,i.width,h);ctx.setLineDash([]);const r=handleRadius();ctx.fillStyle='#fff';ctx.fillRect(i.width/2-r,h/2-r,2*r,2*r);ctx.strokeRect(i.width/2-r,h/2-r,2*r,2*r);ctx.restore();}
 if($('full-dialog').open){
  const view=$('full-board');if(view.width!==board.width||view.height!==board.height){view.width=board.width;view.height=board.height;}
  view.getContext('2d').drawImage(board,0,0);
  $('full-play').textContent=run?'Pausar':'Reproduzir';
 }
 $('seek').value=t;$('clock').textContent=stamp(t)+' / '+stamp(duration());
}
function button(text,fn,pressed){const b=document.createElement('button');b.textContent=text;b.onclick=fn;if(pressed!==undefined)b.setAttribute('aria-pressed',pressed);return b;}
function selectScene(s){if(run)return;sceneId=s.id;itemId=s.items[0]?.id;t=slots().find(x=>x.scene===s).start;edit=true;refresh();}
function refresh(){
 const s=scene();sceneId=s.id;if(!item())itemId=s.items[0]?.id;const i=item(),[w,h]=sizes[project.aspect];
 if(board.width!==w||board.height!==h){board.width=w;board.height=h;}board.classList.toggle('portrait',project.aspect==='portrait');
 $('count').textContent=project.scenes.length+' / 20';
 $('scenes').replaceChildren(...project.scenes.map((sc,n)=>button((n+1)+' · '+(sc.items.find(i=>i.type==='text')?.text.slice(0,23)||sc.name),()=>selectScene(sc),sc===s)));
 $('timeline').replaceChildren(...slots().map((sl,n)=>button((n+1)+' · '+sl.duration.toFixed(1)+' s',()=>selectScene(sl.scene))));
 $('elements').replaceChildren(...s.items.map((el,n)=>new Option((n+1)+'. '+(el.type==='text'?el.text.slice(0,30):el.type==='image'?'Imagem':'Forma'),el.id)));
 $('elements').value=itemId||'';$('item-fields').hidden=!i;$('text-label').hidden=i?.type!=='text';$('shape-label').hidden=i?.type!=='shape';$('crop-actions').hidden=i?.type!=='image';$('font-label').hidden=i?.type!=='text';$('detail-label').hidden=i?.type!=='image';$('font-size').disabled=i?.type!=='text';
 for(const [obj,map] of [[project,projectFields],[s,sceneFields],[i,itemFields]])if(obj)for(const [id,k] of Object.entries(map))$(id).value=obj[k];
 $('flip-x').checked=!!i?.flipX;$('flip-y').checked=!!i?.flipY;
 $('item-timing').textContent=i?'Começa em '+s.items.slice(0,s.items.indexOf(i)).reduce((n,a)=>n+a.duration+a.pause,0).toLocaleString('pt-BR',{maximumFractionDigits:2})+' s nesta cena.':'';
 $('show-hand').checked=project.hand;$('listen').hidden=!s.audio;
 if(s.audio&&$('listen').getAttribute('src')!==s.audio.src)$('listen').src=s.audio.src;
 if(!s.audio&&$('listen').hasAttribute('src')){$('listen').removeAttribute('src');$('listen').load();}
 $('audio-info').textContent=s.audio?s.audio.name+' · '+s.audio.duration.toFixed(1)+' s':'Nenhum áudio nesta cena.';
 $('undo').disabled=!undo.length;$('redo').disabled=!redo.length;$('seek').max=duration();
 paint();const r=++revision;Promise.all(s.items.map(prepare)).then(()=>{if(r===revision&&!run)paint();}).catch(e=>{if(r===revision)say(e.message);});
}
function control(id){const el=$(id);if(el.type!=='number'&&el.type!=='range')return el.value;return clamp(Number(el.value)||0,Number(el.min),Number(el.max));}
for(const [get,map] of [[()=>project,projectFields],[scene,sceneFields],[item,itemFields]])for(const [id,k] of Object.entries(map))$(id).onchange=()=>change(()=>{const obj=get();if(!obj)return;const v=control(id);if(id==='aspect'){const [ow,oh]=sizes[project.aspect],[w,h]=sizes[v];for(const s of project.scenes)for(const i of s.items){i.x=Math.round(i.x*w/ow);i.y=Math.round(i.y*h/oh);i.width=Math.round(clamp(i.width*w/ow,40,960));}}obj[k]=v;});
$('elements').onchange=()=>{itemId=$('elements').value;edit=true;refresh();};$('show-hand').onchange=()=>change(()=>project.hand=$('show-hand').checked);
for(const [id,prop] of [['flip-x','flipX'],['flip-y','flipY']])$(id).onchange=()=>{if(item())change(()=>item()[prop]=$(id).checked);};
for(const skin of ['#f4d9c6','#e4b590','#c98e68','#a96d48','#7d4931','#4d2d20']){const b=button('',()=>change(()=>project.skin=skin));b.style.backgroundColor=skin;b.setAttribute('aria-label','Tom de pele '+skin);$('swatches').append(b);}
function addItem(i,s=scene()){if(s.items.length>=30){say('Limite de 30 elementos por cena.');return;}change(()=>{s.items.push(i);if(scene()===s)itemId=i.id;});}
$('new-text').onclick=()=>addItem({...itemBase(),x:Math.round(board.width*.1),y:Math.min(board.height-90,75+scene().items.length*55),width:Math.round(board.width*.75)});
$('new-shape').onclick=()=>addItem({...itemBase('shape'),x:Math.round(board.width*.25),y:80,width:Math.min(280,board.width*.5)});
$('new-scene').onclick=()=>{if(project.scenes.length>=20)return say('Limite de 20 cenas.');change(()=>{const s=sceneBase('Cena '+(project.scenes.length+1));project.scenes.push(s);sceneId=s.id;itemId=null;});};
$('copy-scene').onclick=()=>{if(project.scenes.length>=20)return say('Limite de 20 cenas.');change(()=>{const s=structuredClone(scene());s.id=uid();s.items.forEach(i=>i.id=uid());s.name+=' · cópia';project.scenes.splice(project.scenes.indexOf(scene())+1,0,s);sceneId=s.id;});};
$('remove-scene').onclick=()=>change(()=>{if(project.scenes.length>1)project.scenes.splice(project.scenes.indexOf(scene()),1);else project.scenes=[sceneBase()];sceneId=project.scenes[0].id;});
$('remove-item').onclick=()=>change(()=>scene().items=scene().items.filter(i=>i.id!==itemId));
function move(list,at,dir){const to=at+dir;if(at>=0&&to>=0&&to<list.length)change(()=>[list[at],list[to]]=[list[to],list[at]]);}
for(const [suffix,dir] of [['up',-1],['down',1]]){$('scene-'+suffix).onclick=()=>move(project.scenes,project.scenes.indexOf(scene()),dir);$('item-'+suffix).onclick=()=>move(scene().items,scene().items.indexOf(item()),dir);}
function recall(from,to){if(run||!from.length)return;to.push(project);project=from.pop();t=clamp(t,0,duration());edit=true;schedule();refresh();}
$('undo').onclick=()=>recall(undo,redo);$('redo').onclick=()=>recall(redo,undo);
const handleRadius=()=>Math.max(7,7*board.width/Math.max(1,board.getBoundingClientRect().width));
const coord=e=>{const r=board.getBoundingClientRect();return [(e.clientX-r.left)*board.width/r.width,(e.clientY-r.top)*board.height/r.height];};
board.onpointerdown=e=>{if(run||drag)return;const [x,y]=coord(e);
 const selected=item(),ordered=[selected,...[...scene().items].reverse().filter(i=>i!==selected)].filter(Boolean);
 for(const i of ordered){const bmp=caches.get(i)?.result?.bmp;if(!bmp)continue;const h=i.width*bmp.height/bmp.width,a=i.rotation*Math.PI/180,dx=x-i.x-i.width/2,dy=y-i.y-h/2,c=Math.cos(a),k=Math.sin(a),lx=dx*c+dy*k,ly=-dx*k+dy*c;
 const resize=edit&&i===selected&&Math.abs(lx-i.width/2)<=handleRadius()*1.6&&Math.abs(ly-h/2)<=handleRadius()*1.6;
 if(resize||Math.abs(lx)<=i.width/2&&Math.abs(ly)<=h/2){itemId=i.id;edit=true;drag={i,x,y,ox:i.x,oy:i.y,w:i.width,h,c,k,resize,moved:false,pointer:e.pointerId};board.setPointerCapture(e.pointerId);refresh();break;}}
};
board.onpointermove=e=>{if(!drag||drag.pointer!==e.pointerId)return;const [x,y]=coord(e),dx=x-drag.x,dy=y-drag.y,{i,w,h,c,k}=drag;if(!drag.moved){snapshot();drag.moved=true;}
 if(drag.resize){
  const factor=clamp(1+((dx*c+dy*k)*w+(-dx*k+dy*c)*h)/(w*w+h*h),40/w,960/w);
  const dw=w*(factor-1),dh=h*(factor-1);
  i.width=Math.round(w*factor);i.x=Math.round(drag.ox+(dw*c-dh*k-dw)/2);i.y=Math.round(drag.oy+(dw*k+dh*c-dh)/2);$('width').value=i.width;
 }else{i.x=Math.round(clamp(drag.ox+dx,-100,board.width-20));i.y=Math.round(clamp(drag.oy+dy,-100,board.height-20));}
 $('x').value=i.x;$('y').value=i.y;paint();};
board.onpointerup=board.onpointercancel=()=>{if(drag?.moved){schedule();refresh();}drag=null;};

const cropDialog=$('crop-dialog'),cropCanvas=$('crop-preview'),cropCtx=cropCanvas.getContext('2d');
const cropInputs=['crop-x','crop-y','crop-w','crop-h'];let cropItem,cropImage,cropValue,cropStart;
function drawCrop(){
 const w=cropCanvas.width,h=cropCanvas.height,[x,y,cw,ch]=cropValue;
 cropCtx.clearRect(0,0,w,h);cropCtx.drawImage(cropImage,0,0,w,h);
 cropCtx.fillStyle='#102d5088';cropCtx.beginPath();cropCtx.rect(0,0,w,h);cropCtx.rect(x*w,y*h,cw*w,ch*h);cropCtx.fill('evenodd');
 cropCtx.strokeStyle='#fff';cropCtx.lineWidth=2;cropCtx.strokeRect(x*w,y*h,cw*w,ch*h);
}
function updateCrop(values){cropValue=cropRect(values);cropInputs.forEach((id,k)=>$(id).value=Math.round(cropValue[k]*100));drawCrop();}
$('crop-open').onclick=async()=>{const i=item();if(run||i?.type!=='image')return;const img=new Image();img.src=i.src;try{await img.decode();}catch{return say('Não foi possível abrir a imagem para recorte.');}if(run||item()!==i||cropDialog.open)return;
 cropItem=i;cropImage=img;cropStart=null;const q=Math.min(420/img.naturalWidth,300/img.naturalHeight,1);cropCanvas.width=Math.max(1,Math.round(img.naturalWidth*q));cropCanvas.height=Math.max(1,Math.round(img.naturalHeight*q));updateCrop(i.crop);cropDialog.showModal();
};
for(const id of cropInputs)$(id).onchange=()=>updateCrop(cropInputs.map(id=>+$(id).value/100));
const cropPoint=e=>{const r=cropCanvas.getBoundingClientRect();return [clamp((e.clientX-r.left)/r.width,0,1),clamp((e.clientY-r.top)/r.height,0,1)];};
cropCanvas.onpointerdown=e=>{cropStart=cropPoint(e);cropCanvas.setPointerCapture(e.pointerId);};
cropCanvas.onpointermove=e=>{if(!cropStart)return;const [x,y]=cropPoint(e),[a,b]=cropStart;updateCrop([Math.min(x,a),Math.min(y,b),Math.abs(x-a),Math.abs(y-b)]);};
cropCanvas.onpointerup=cropCanvas.onpointercancel=()=>cropStart=null;
$('crop-apply').onclick=()=>{if(item()===cropItem)change(()=>cropItem.crop=cropValue);cropDialog.close();};
$('crop-cancel').onclick=()=>cropDialog.close();
$('crop-reset').onclick=()=>{if(item()?.type==='image')change(()=>item().crop=[0,0,1,1]);};

const dataURL=blob=>new Promise((res,rej)=>{const f=new FileReader();f.onload=()=>res(f.result);f.onerror=()=>rej(Error('Não foi possível ler o arquivo.'));f.readAsDataURL(blob);});
$('image').onchange=async e=>{const f=e.target.files[0],s=scene();e.target.value='';if(!f)return;try{if(!/^image\/(png|jpeg|webp)$/.test(f.type)||f.size>12*1024*1024)throw Error('Use JPG, PNG ou WebP de até 12 MB.');const img=new Image();img.src=await dataURL(f);await img.decode();if(img.width*img.height>40000000)throw Error('Reduza a resolução da imagem e tente de novo.');
 const c=document.createElement('canvas'),q=Math.min(1,1200/Math.max(img.width,img.height));c.width=Math.max(1,Math.round(img.width*q));c.height=Math.max(1,Math.round(img.height*q));c.getContext('2d').drawImage(img,0,0,c.width,c.height);
 if(!project.scenes.includes(s)||run)return;addItem({...itemBase('image'),x:55,y:75,width:Math.min(430,board.width*.72),duration:6,src:c.toDataURL('image/webp',.92)},s);say('Imagem adicionada. Reproduza para ver os contornos.');
 }catch(err){say(err.message);}};
let audioCtx;const getAudio=()=>audioCtx??=new (window.AudioContext||window.webkitAudioContext)();
async function decode(src){if(audioCache.has(src))return audioCache.get(src);const b=await getAudio().decodeAudioData(await fetch(src).then(r=>r.arrayBuffer()));audioCache.set(src,b);if(audioCache.size>10)audioCache.delete(audioCache.keys().next().value);return b;}
async function attach(blob,name,s){if(blob.size>25*1024*1024)throw Error('Use áudio de até 25 MB.');const src=await dataURL(blob),audio=await decode(src);if(audio.duration>600)throw Error('Use áudio de até 10 minutos.');if(run||!project.scenes.includes(s))throw Error('A cena mudou. Gere o áudio novamente.');change(()=>s.audio={src,name,duration:audio.duration});say('Áudio pronto. Ouça e ajuste a duração da cena.');}
$('audio').onchange=async e=>{const f=e.target.files[0],s=scene();e.target.value='';if(!f)return;try{if(!f.type.startsWith('audio/'))throw Error('Selecione um áudio WAV ou MP3.');await attach(f,f.name,s);}catch(err){say(err.message);}};
$('remove-audio').onclick=()=>change(()=>scene().audio=null);
$('fit').onclick=()=>{const s=scene();if(!s.audio)return say('Adicione um áudio primeiro.');change(()=>{const target=s.audio.duration+s.offset+.2,base=s.items.reduce((n,i)=>n+i.duration+i.pause,0);if(target-base>30&&base){const q=(target-25)/base;for(const i of s.items)i.duration=clamp(i.duration*q,.5,30);}s.hold=clamp(target-(contentTime(s)-s.hold),0,30);say(contentTime(s)<target-.3?'O áudio ainda é mais longo que a cena. Divida o áudio entre cenas.':'Cena ajustada. Confira a sincronização na prévia.');});};
function generateVoice(data){return new Promise((res,rej)=>{const w=new Worker(new URL('./voice-worker.js',import.meta.url)),finish=(err,wav)=>{clearTimeout(timer);w.terminate();err?rej(Error(err)):res(wav);},timer=setTimeout(()=>finish('A narração demorou demais. Tente um texto menor.'),45000);w.onmessage=({data})=>finish(data.error,data.wav);w.onerror=()=>finish('A voz local não iniciou neste aparelho.');w.postMessage(data);});}
$('generate').onclick=async()=>{const s=scene(),text=$('narration').value.trim();if(!text)return say('Digite um texto para narrar.');$('generate').disabled=true;say('Gerando voz no navegador…');try{const wav=await generateVoice({text,speed:s.speed,pitch:s.pitch,gap:s.gap,variant:s.voice});await attach(new Blob([wav],{type:'audio/wav'}),'Narração sintética.wav',s);}catch(e){say(e.message);}finally{$('generate').disabled=!!run;}};
$('clone').onclick=async()=>{const s=scene(),text=$('narration').value.trim(),file=$('reference').files[0];try{
 if(!$('consent').checked||!file||!text)throw Error('Informe texto, referência e autorização de uso e envio.');
 if(file.size>10*1024*1024)throw Error('Use um WAV de até 10 MB.');
 const url=new URL($('voice-url').value);if(url.username||url.password||(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))throw Error('Informe um servidor HTTPS ou localhost.');
 const data=new FormData();data.append('text',text);data.append('reference',file);$('clone').disabled=true;say('Gerando voz no servidor informado…');
 const result=await fetch(new URL('/synthesize',url),{method:'POST',body:data,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(120000)});
 if(!result.ok)throw Error('O servidor de voz não conseguiu gerar a narração.');await attach(await result.blob(),'Voz de referência.wav',s);
 }catch(err){say(err.message);}finally{$('clone').disabled=!!run;}};
function download(blob,suffix){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(project.name.replace(/[^\p{L}\p{N}_-]/gu,'-')||'whiteboard')+suffix;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);}
function locked(on){document.querySelectorAll('.wb button,.wb select,.wb input,.wb textarea').forEach(e=>{if(!['stop','play','full-play','full-close','full-open'].includes(e.id))e.disabled=on;});$('play').disabled=on&&!!run?.exporting;if(!on){$('undo').disabled=!undo.length;$('redo').disabled=!redo.length;$('font-size').disabled=item()?.type!=='text';}}
function finish(complete=false){const r=run;if(!r)return;run=null;cancelAnimationFrame(r.frame);for(const source of r.sources)try{source.stop();}catch{}if(r.recorder?.state==='recording'){r.complete=complete;r.recorder.stop();}else r.stream?.getTracks().forEach(k=>k.stop());$('play').textContent='▶ Reproduzir';locked(false);if(complete&&!r.exporting)say('Prévia concluída. Exporte quando estiver pronto.');}
async function play(exporting=false){
 if(run){if(!run.exporting){finish();say('Prévia pausada.');}return;}
 if(mic)return say('Finalize a gravação de voz antes de reproduzir.');
 synth?.cancel();
 const length=duration();if(!length||length>600||exporting&&length>180)return say(exporting?'Exporte vídeos de até 3 minutos.':'O projeto precisa ter entre 0 e 10 minutos.');
 const r={exporting,sources:[]};run=r;locked(true);$('listen').pause();say('Preparando desenho e áudio…');
 try{
 const ac=getAudio();await ac.resume();if(project.hand)await loadHand(project.handModel);const list=slots();await Promise.all(project.scenes.flatMap(s=>s.items.map(prepare)));const audio=await Promise.all(list.map(({scene:s})=>s.audio?decode(s.audio.src):null));if(run!==r)return;
 const offset=exporting||t>=length?0:t;edit=false;t=offset;paint();let dest;
 if(exporting){
  if(!window.MediaRecorder||!board.captureStream)throw Error('Este navegador não exporta vídeo. Salve o projeto e abra no computador.');
  const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/mp4','video/webm'].find(s=>MediaRecorder.isTypeSupported(s));if(!mime)throw Error('O navegador não tem formato de exportação compatível.');
  const stream=r.stream=board.captureStream(30);if(audio.some(Boolean)){dest=ac.createMediaStreamDestination();for(const track of dest.stream.getAudioTracks())stream.addTrack(track);}
  const rec=r.recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3000000}),chunks=[];
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  rec.onerror=()=>{finish();say('A gravação falhou. Tente outro navegador ou um vídeo menor.');};
  rec.onstop=()=>{stream.getTracks().forEach(k=>k.stop());if(r.complete&&chunks.length){download(new Blob(chunks,{type:rec.mimeType}),mime.includes('mp4')?'.mp4':'.webm');say('Vídeo exportado. Confira o arquivo antes de compartilhar.');}};
  rec.start(250);
 }
 const now=ac.currentTime;
 list.forEach(({scene:s,start,duration:d},n)=>{const b=audio[n];if(!b)return;const begin=start+s.offset,elapsed=Math.max(0,offset-begin),available=Math.min(b.duration-elapsed,start+d-Math.max(offset,begin));if(available<=0)return;
  const source=ac.createBufferSource();source.buffer=b;const chain=voiceChain(ac,source,s);chain.output.connect(ac.destination);if(dest)chain.output.connect(dest);source.onended=()=>{source.disconnect();chain.stop();};source.start(now+Math.max(0,begin-offset),elapsed,available);r.sources.push(source);
 });
 const start=performance.now();if(!exporting)$('play').textContent='Ⅱ Pausar';say(exporting?'Exportando. Mantenha a aba aberta e visível.':'Reproduzindo sua história.');
 const tick=()=>{if(run!==r)return;t=Math.min(length,offset+(performance.now()-start)/1000);paint();if(t>=length)finish(true);else r.frame=requestAnimationFrame(tick);};tick();
 }catch(err){if(run===r){finish();say(err.message);}}
}
$('play').onclick=()=>play();$('export').onclick=()=>play(true);$('stop').onclick=()=>{const exporting=run?.exporting;finish();t=0;edit=true;paint();say(exporting?'Exportação cancelada. Nenhum arquivo parcial foi baixado.':'Prévia parada.');};$('seek').oninput=()=>{if(!run){t=+$('seek').value;edit=false;paint();}};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&run?.exporting){finish();say('Exportação interrompida. Mantenha a aba visível ao exportar.');}});
$('save').onclick=()=>download(new Blob([JSON.stringify(project)],{type:'application/json'}),'.whiteboard.json');
const validColor=(v,d)=>/^#[0-9a-f]{6}$/i.test(v)?v:d;
const pick=(v,allowed,d)=>allowed.includes(v)?v:d;
const str=(v,n)=>typeof v==='string'?v.slice(0,n):'';
const number=(v,min,max,d)=>Number.isFinite(v)?clamp(v,min,max):d;
function sanitize(p){
 if(p?.version!==1||!Array.isArray(p.scenes)||!p.scenes.length||p.scenes.length>20)throw Error('Selecione um projeto salvo neste editor.');
 return {version:1,name:str(p.name,90)||'Meu projeto',aspect:pick(p.aspect,Object.keys(sizes),'landscape'),background:validColor(p.background,'#ffffff'),skin:validColor(p.skin,'#c98e68'),pen:pick(p.pen,['bic','ball','three','fountain','quill','ink'],'bic'),hand:p.hand!==false,handModel:handModel(p.handModel),scenes:p.scenes.map(s=>{
  if(!Array.isArray(s?.items)||s.items.length>30)throw Error('Cena inválida no projeto.');const out=sceneBase(str(s.name,90)||'Cena');
  Object.assign(out,{transition:pick(s.transition,['erase','fade','cut'],'erase'),hold:number(s.hold,0,30,1),volume:number(s.volume,0,1,1),offset:number(s.offset,0,120,0),narration:str(s.narration,3000),voice:pick(s.voice,['m1','m3','f2','f5'],'m1'),speed:number(s.speed,90,300,160),pitch:number(s.pitch,15,85,50),gap:number(s.gap,0,15,0),voiceStyle:pick(s.voiceStyle,voiceStyles,'clean'),bass:number(s.bass,-12,12,0),mids:number(s.mids,-12,12,0),treble:number(s.treble,-12,12,0)});
  if(s.audio&&/^data:audio\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/i.test(s.audio.src))out.audio={src:s.audio.src,name:str(s.audio.name,100),duration:number(s.audio.duration,0,600,0)};
  out.items=s.items.map(i=>{const a=itemBase(pick(i.type,['text','image','shape'],'text'));if(a.type==='image'){if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(i.src))throw Error('Imagem inválida no projeto.');a.src=i.src;}
   for(const [k,min,max] of [['x',-100,960],['y',-100,960],['width',40,960],['rotation',-180,180],['duration',.5,30],['pause',0,15],['fontSize',16,130],['detail',12,80]])a[k]=number(i[k],min,max,a[k]);
   return {...a,flipX:i.flipX===true,flipY:i.flipY===true,text:str(i.text,500),color:validColor(i.color,a.color),font:pick(i.font,Object.keys(fonts),'hand'),shape:pick(i.shape,Object.keys(shapes),'bulb'),crop:cropRect(i.crop),effect:pick(i.effect,effects,'draw')};
  });return out;
 })};
}
function replace(p){project=p;sceneId=p.scenes[0].id;itemId=p.scenes[0].items[0]?.id;t=0;}
$('open').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(f.size>40*1024*1024)throw Error('Use um projeto de até 40 MB.');const p=sanitize(JSON.parse(await f.text()));change(()=>replace(p));say('Projeto aberto.');}catch(err){say(err instanceof SyntaxError?'Arquivo de projeto inválido.':err.message);}};
const full=$('full-dialog');
$('full-open').onclick=()=>{if(!run?.exporting&&!full.open){full.showModal();paint();}};
$('full-close').onclick=()=>full.close();
$('full-play').onclick=()=>play();
full.onclose=()=>{if(run&&!run.exporting)finish();paint();};
const synth=window.speechSynthesis;let deviceVoices=[];
function populateVoices(){
 const selected=$('device-voice').value;
 deviceVoices=(synth?.getVoices()||[]).filter(v=>/^pt(?:[-_]|$)/i.test(v.lang)&&v.localService).sort((a,b)=>Number(/pt-br/i.test(b.lang))-Number(/pt-br/i.test(a.lang)));
 $('device-voice').replaceChildren(...(deviceVoices.length?deviceVoices.map(v=>new Option(v.name+' · '+v.lang,v.voiceURI)):[new Option('Nenhuma voz local em português','')]));
 if(deviceVoices.some(v=>v.voiceURI===selected))$('device-voice').value=selected;
}
synth?.addEventListener('voiceschanged',populateVoices);populateVoices();
$('device-speak').onclick=()=>{
 populateVoices();const voice=deviceVoices.find(v=>v.voiceURI===$('device-voice').value);
 const text=$('narration').value.trim().replace(/\[pausa=[^\]]*\]/g,', ');
 if(!voice||!text)return say(voice?'Digite o texto para ouvir.':'Este aparelho não ofereceu uma voz local em português. Você pode gravar sua voz.');
 const utterance=new SpeechSynthesisUtterance(text);utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=.96;
 utterance.onerror=e=>{if(!['canceled','interrupted'].includes(e.error))say('Não foi possível reproduzir a voz do aparelho.');};
 synth.cancel();synth.speak(utterance);
};
$('device-stop').onclick=()=>synth?.cancel();
let mic;
function stopMic(){if(mic?.rec.state==='recording')mic.rec.stop();}
$('record-stop').onclick=stopMic;
$('record-voice').onclick=async()=>{
 if(mic||run)return;
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)return say('O microfone não está disponível neste navegador. Você pode enviar um áudio.');
 const target=scene();let stream;$('record-voice').disabled=true;
 try{
  stream=await navigator.mediaDevices.getUserMedia({audio:true});
  if(run||scene()!==target){stream.getTracks().forEach(t=>t.stop());$('record-voice').disabled=!!run;return;}
  const rec=new MediaRecorder(stream),chunks=[];
  const cleanup=()=>{clearTimeout(mic?.timer);stream.getTracks().forEach(t=>t.stop());mic=null;$('record-stop').hidden=true;$('record-voice').disabled=!!run;};
  let failed=false;
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  rec.onerror=()=>{failed=true;cleanup();say('A gravação falhou. Tente enviar um arquivo de áudio.');};
  rec.onstop=async()=>{cleanup();if(failed)return;try{if(!chunks.length)throw Error('A gravação ficou vazia.');const mime=(rec.mimeType||chunks[0].type||'audio/webm').split(';')[0].replace(/^video\//,'audio/');await attach(new Blob(chunks,{type:mime}),'Narração gravada',target);}catch(e){say(e.message);}};
  synth?.cancel();rec.start(250);mic={rec,timer:setTimeout(stopMic,180000)};
  $('record-stop').hidden=false;say('Gravando sua voz. Clique em Finalizar gravação quando terminar.');
 }catch{stream?.getTracks().forEach(t=>t.stop());$('record-voice').disabled=!!run;say('O microfone não foi liberado. Você pode enviar um áudio gravado no aparelho.');}
};
loadHand('masculina');loadHand('feminina');
refresh();try{const saved=await draft(false);if(saved&&!undo.length&&!run){replace(sanitize(saved));refresh();say('Rascunho recuperado neste aparelho.');}}catch{}
if('serviceWorker'in navigator)navigator.serviceWorker.register(new URL('./sw.js',import.meta.url)).catch(()=>{});
