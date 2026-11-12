importScripts('vendor/mespeak.js');
let ready;
const load=()=>ready??=Promise.all(['mespeak_config','pt'].map(s=>fetch('vendor/'+s+'.json').then(r=>{if(!r.ok)throw Error('Voz indisponível.');return r.json();}))).then(([config,voice])=>{meSpeak.loadConfig(config);meSpeak.loadVoice(voice);});
function pcm(raw){const a=Uint8Array.from(raw),v=new DataView(a.buffer);let rate=22050,align=2,bits=16,channels=1;
 for(let o=12;o+8<=a.length;){const tag=String.fromCharCode(...a.subarray(o,o+4)),size=v.getUint32(o+4,true);if(tag==='fmt '){channels=v.getUint16(o+10,true);rate=v.getUint32(o+12,true);align=v.getUint16(o+20,true);bits=v.getUint16(o+22,true);}if(tag==='data')return {rate,align,bits,channels,data:a.slice(o+8,o+8+size)};o+=8+size+(size%2);}
 throw Error('O sintetizador não gerou áudio.');
}
self.onmessage=async({data:{text,variant,speed,pitch,gap}})=>{try{
 await load();const chunks=[];let fmt;
 for(const s of text.split(/(\[pausa=\d+(?:\.\d+)?\])/g)){if(!s.trim())continue;const m=s.match(/^\[pausa=(.+)\]$/);if(m)chunks.push(clampPause(m[1]));else{fmt=pcm(meSpeak.speak(s,{rawdata:'array',speed,pitch,variant,wordgap:gap}));chunks.push(fmt.data);}}
 if(!fmt)throw Error('Digite uma frase para narrar.');
 const {rate,align,bits,channels}=fmt,arrays=chunks.map(a=>typeof a==='number'?new Uint8Array(Math.round(a*rate)*align).fill(bits===8?128:0):a);
 const size=arrays.reduce((s,a)=>s+a.length,0),wav=new Uint8Array(size+44),v=new DataView(wav.buffer),tag=(o,s)=>wav.set([...s].map(c=>c.charCodeAt(0)),o);
 tag(0,'RIFF');v.setUint32(4,size+36,true);tag(8,'WAVE');tag(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,rate,true);v.setUint32(28,rate*align,true);v.setUint16(32,align,true);v.setUint16(34,bits,true);tag(36,'data');v.setUint32(40,size,true);let o=44;for(const a of arrays){wav.set(a,o);o+=a.length;}
 self.postMessage({wav:wav.buffer},[wav.buffer]);
 }catch(error){self.postMessage({error:error.message});}};
function clampPause(s){return Math.min(10,Math.max(0,+s));}
