import {handModel,loadHand,drawWritingHand} from './hand-sprites.js';
import {clamp,drawStrokes,strokeAt,hand,timeline,contentTime} from './engine.js';
const $=id=>document.getElementById(id),board=$('board'),ctx=board.getContext('2d');
const uid=()=>crypto.randomUUID(),say=s=>$('notice').textContent=s;
const itemBase=(type='text')=>({id:uid(),type,text:'Sua ideia começa aqui.',x:100,y:100,width:700,font:'hand',fontSize:58,color:'#102d50',rotation:0,duration:4,pause:.5,effect:'draw',detail:34,src:''});
const sceneBase=(name='Nova cena')=>({id:uid(),name,items:[],hold:1,transition:'erase',audio:null,narration:'',voice:'m1',speed:160,pitch:50,gap:0,volume:1,offset:0});
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
const sceneFields={hold:'hold',transition:'transition',volume:'volume',offset:'offset',narration:'narration',voice:'voice',speed:'speed',pitch:'pitch',gap:'gap'};
const itemFields={text:'text',effect:'effect',font:'font','font-size':'fontSize',ink:'color',duration:'duration',pause:'pause',x:'x',y:'y',width:'width',rotation:'rotation',detail:'detail'};
const caches=new WeakMap();let tracer;const waiting=new Map(),audioCache=new Map();
const key=i=>[i.type,i.text,i.font,i.fontSize,i.color,i.detail,i.effect,i.src].join('|');
function raster(i){
 const c=document.createElement('canvas'),g=c.getContext('2d');
 if(i.type==='image')return new Promise((res,rej)=>{const img=new Image();img.onload=()=>{const q=Math.min(1,520/Math.max(img.width,img.height));c.width=Math.max(1,Math.round(img.width*q));c.height=Math.max(1,Math.round(img.height*q));g.drawImage(img,0,0,c.width,c.height);res(c);};img.onerror=()=>rej(Error('Imagem inválida.'));img.src=i.src;});
 if(i.type==='shape'){
  c.width=320;c.height=290;g.strokeStyle=i.color;g.lineWidth=8;g.lineCap='round';g.lineJoin='round';
  const p=new Path2D('M126 209 Q125 183 96 155 C57 112 82 49 131 33 C192 11 245 60 236 112 Q233 138 209 160 Q189 182 191 209 Z M134 230 H183 M141 252 H177 M158 208 V124 M139 116 L158 132 L178 116 M58 57 L38 37 M260 57 L280 37 M158 13 V4 M53 117 H29 M265 117 H289');
  g.stroke(p);return c;
 }
 const fonts={hand:'"Comic Sans MS","Segoe Print",cursive',sans:'Arial,sans-serif',serif:'Georgia,serif'},font=i.fontSize+'px '+fonts[i.font],lineHeight=Math.ceil(i.fontSize*1.35),lines=[];
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
 const entry={key:k,promise:null,result:null};entry.promise=(async()=>{const bmp=await raster(i),index=i.effect==='draw'?await trace(bmp,i):null;return entry.result={bmp,index};})().catch(e=>{if(caches.get(i)===entry)caches.delete(i);throw e;});caches.set(i,entry);return entry.promise;
}
function drawItem(i,p,withHand){
 const cache=caches.get(i)?.result;if(!cache||p<=0)return;
 const {bmp,index}=cache,scale=i.width/bmp.width,h=bmp.height*scale;
 ctx.save();ctx.translate(i.x+i.width/2,i.y+h/2);ctx.rotate(i.rotation*Math.PI/180);ctx.translate(-i.width/2,-h/2);ctx.scale(scale,scale);
 if(p>=1)ctx.drawImage(bmp,0,0);
 else if(i.effect==='fade'||!index&&i.effect!=='slide'){ctx.globalAlpha=p;ctx.drawImage(bmp,0,0);}
 else if(i.effect==='slide'){ctx.translate(-.65*bmp.width*(1-p),0);ctx.drawImage(bmp,0,0);if(withHand)hand(ctx,bmp.width*.7,bmp.height*.32,0,project.skin,'grip',.7/scale);}
 else{const progress=clamp(p/.92,0,1);ctx.strokeStyle=i.color;ctx.lineWidth=i.type==='text'?Math.max(2,i.fontSize/14):2;ctx.lineJoin=ctx.lineCap='round';drawStrokes(ctx,index,progress);
  if(p>.92){ctx.globalAlpha=(p-.92)/.08;ctx.drawImage(bmp,0,0);ctx.globalAlpha=1;}const tip=strokeAt(index,progress);if(withHand&&tip&&!drawWritingHand(ctx,tip.x,tip.y,tip.angle,project.handModel,scale))hand(ctx,tip.x,tip.y,tip.angle,project.skin,project.pen,.82/scale);
 }
 ctx.restore();
}
function paint(){
 const list=slots(),slot=list.find(x=>t>=x.start&&t<x.start+x.duration)||list.at(-1),s=edit?scene():slot.scene,local=t-slot.start;ctx.fillStyle=project.background;ctx.fillRect(0,0,board.width,board.height);
 let offset=0;for(const i of s.items){drawItem(i,edit?1:clamp((local-offset)/i.duration,0,1),!edit&&project.hand);offset+=i.duration+i.pause;}
 const tail=local-contentTime(s);
 if(!edit&&tail>0&&s.transition==='fade'){ctx.globalAlpha=clamp(tail/.5,0,1);ctx.fillStyle=project.background;ctx.fillRect(0,0,board.width,board.height);ctx.globalAlpha=1;}
 if(!edit&&tail>0&&s.transition==='erase'){const step=clamp(tail/1.2,0,1)*5,b=board.height/5;ctx.fillStyle=project.background;for(let n=0;n<5;n++){const w=clamp(step-n,0,1)*board.width;ctx.fillRect(n%2?board.width-w:0,n*b,w,b+1);}if(project.hand&&step<5){const n=Math.floor(step),q=step-n;hand(ctx,board.width*(n%2?1-q:q),(n+.5)*b,0,project.skin,'eraser');}}
 const i=item(),bmp=i&&caches.get(i)?.result?.bmp;if(edit&&bmp){const h=i.width*bmp.height/bmp.width;ctx.save();ctx.translate(i.x+i.width/2,i.y+h/2);ctx.rotate(i.rotation*Math.PI/180);ctx.setLineDash([6,4]);ctx.strokeStyle='#659a85';ctx.strokeRect(-i.width/2,-h/2,i.width,h);ctx.restore();}
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
 $('elements').value=itemId||'';$('item-fields').hidden=!i;$('text-label').hidden=i?.type!=='text';$('font-label').hidden=i?.type!=='text';$('detail-label').hidden=i?.type!=='image';$('font-size').disabled=i?.type!=='text';
 for(const [obj,map] of [[project,projectFields],[s,sceneFields],[i,itemFields]])if(obj)for(const [id,k] of Object.entries(map))$(id).value=obj[k];
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
const coord=e=>{const r=board.getBoundingClientRect();return [(e.clientX-r.left)*board.width/r.width,(e.clientY-r.top)*board.height/r.height];};
board.onpointerdown=e=>{if(run)return;const [x,y]=coord(e);
 for(const i of [...scene().items].reverse()){const bmp=caches.get(i)?.result?.bmp;if(!bmp)continue;const h=i.width*bmp.height/bmp.width,a=-i.rotation*Math.PI/180,dx=x-i.x-i.width/2,dy=y-i.y-h/2;
 if(Math.abs(dx*Math.cos(a)-dy*Math.sin(a))<=i.width/2&&Math.abs(dx*Math.sin(a)+dy*Math.cos(a))<=h/2){itemId=i.id;edit=true;drag={i,x,y,ox:i.x,oy:i.y,moved:false};board.setPointerCapture(e.pointerId);refresh();break;}}
};
board.onpointermove=e=>{if(!drag)return;const [x,y]=coord(e);if(!drag.moved){snapshot();drag.moved=true;}drag.i.x=Math.round(clamp(drag.ox+x-drag.x,-100,board.width-20));drag.i.y=Math.round(clamp(drag.oy+y-drag.y,-100,board.height-20));$('x').value=drag.i.x;$('y').value=drag.i.y;paint();};
board.onpointerup=board.onpointercancel=()=>{if(drag?.moved){schedule();refresh();}drag=null;};
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
function locked(on){document.querySelectorAll('.wb button,.wb select,.wb input,.wb textarea').forEach(e=>{if(e.id!=='stop'&&e.id!=='play')e.disabled=on;});$('play').disabled=on&&!!run?.exporting;if(!on){$('undo').disabled=!undo.length;$('redo').disabled=!redo.length;$('font-size').disabled=item()?.type!=='text';}}
function finish(complete=false){const r=run;if(!r)return;run=null;cancelAnimationFrame(r.frame);for(const source of r.sources)try{source.stop();}catch{}if(r.recorder?.state==='recording'){r.complete=complete;r.recorder.stop();}else r.stream?.getTracks().forEach(k=>k.stop());$('play').textContent='▶ Reproduzir';locked(false);if(complete&&!r.exporting)say('Prévia concluída. Exporte quando estiver pronto.');}
async function play(exporting=false){
 if(run){if(!run.exporting){finish();say('Prévia pausada.');}return;}
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
  const source=ac.createBufferSource(),gain=ac.createGain();source.buffer=b;gain.gain.value=s.volume;source.connect(gain);gain.connect(ac.destination);if(dest)gain.connect(dest);source.onended=()=>{source.disconnect();gain.disconnect();};source.start(now+Math.max(0,begin-offset),elapsed,available);r.sources.push(source);
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
  Object.assign(out,{transition:pick(s.transition,['erase','fade','cut'],'erase'),hold:number(s.hold,0,30,1),volume:number(s.volume,0,1,1),offset:number(s.offset,0,120,0),narration:str(s.narration,3000),voice:pick(s.voice,['m1','m3','f2','f5'],'m1'),speed:number(s.speed,90,300,160),pitch:number(s.pitch,15,85,50),gap:number(s.gap,0,15,0)});
  if(s.audio&&/^data:audio\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/i.test(s.audio.src))out.audio={src:s.audio.src,name:str(s.audio.name,100),duration:number(s.audio.duration,0,600,0)};
  out.items=s.items.map(i=>{const a=itemBase(pick(i.type,['text','image','shape'],'text'));if(a.type==='image'){if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(i.src))throw Error('Imagem inválida no projeto.');a.src=i.src;}
   for(const [k,min,max] of [['x',-100,960],['y',-100,960],['width',40,960],['rotation',-180,180],['duration',.5,30],['pause',0,15],['fontSize',16,130],['detail',12,80]])a[k]=number(i[k],min,max,a[k]);
   return {...a,text:str(i.text,500),color:validColor(i.color,a.color),font:pick(i.font,['hand','sans','serif'],'hand'),effect:pick(i.effect,['draw','slide','fade'],'draw')};
  });return out;
 })};
}
function replace(p){project=p;sceneId=p.scenes[0].id;itemId=p.scenes[0].items[0]?.id;t=0;}
$('open').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(f.size>40*1024*1024)throw Error('Use um projeto de até 40 MB.');const p=sanitize(JSON.parse(await f.text()));change(()=>replace(p));say('Projeto aberto.');}catch(err){say(err instanceof SyntaxError?'Arquivo de projeto inválido.':err.message);}};
loadHand('masculina');loadHand('feminina');
refresh();try{const saved=await draft(false);if(saved&&!undo.length&&!run){replace(sanitize(saved));refresh();say('Rascunho recuperado neste aparelho.');}}catch{}
if('serviceWorker'in navigator)navigator.serviceWorker.register(new URL('./sw.js',import.meta.url)).catch(()=>{});
