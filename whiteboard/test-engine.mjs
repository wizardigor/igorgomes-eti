import assert from 'node:assert/strict';
import {edgeMask,skeleton,tracePixels,indexPaths,strokeAt,timeline} from './engine.js';
const w=64,h=48,rgba=new Uint8ClampedArray(w*h*4).fill(255);
const black=(x,y)=>{const i=4*(y*w+x);rgba[i]=rgba[i+1]=rgba[i+2]=0;};
for(let y=6;y<42;y++)for(let x=6;x<58;x++){if(x<10||x>=54||y<10||y>=38||(x>25&&x<36&&y>19&&y<29))black(x,y);}
const edges=edgeMask(rgba,w,h,34),mask=skeleton(edges,w,h),paths=tracePixels(mask,w,h),index=indexPaths(paths);
assert.ok(paths.some(p=>p.some(([x,y])=>x>=24&&x<=37&&y>=18&&y<=30)),'contorno interno');
assert.ok(paths.some(p=>p.some(([x,y])=>x<=10&&y<38)),'contorno externo');
assert.ok(mask.reduce((s,v)=>s+v,0)<edges.reduce((s,v)=>s+v,0));
for(const q of [0,.1,.5,.9,1]){const t=strokeAt(index,q);assert.ok(mask[Math.round(t.y)*w+Math.round(t.x)]);}
assert.equal(strokeAt(indexPaths([[[0,0],[10,0],[10,10]]]),.75).y,5);
assert.equal(timeline([{items:[{duration:3,pause:1}],hold:2,transition:'erase'},{items:[],hold:1,transition:'cut'}])[1].start,7.2);
console.log('Traços, contornos internos/externos, posição da ponta e duração conferidos.');
