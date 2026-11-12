import {skeleton,tracePixels,edgeMask,indexPaths} from './engine.js';
self.onmessage=({data:{id,pixels,w,h,detail,row}})=>{
 try{let mask;if(detail===null){mask=new Uint8Array(w*h);for(let i=0;i<mask.length;i++)mask[i]=+(pixels[4*i+3]>100);}else mask=edgeMask(pixels,w,h,detail);
 self.postMessage({id,index:indexPaths(tracePixels(skeleton(mask,w,h),w,h,row))});}
 catch(error){self.postMessage({id,error:error.message});}
};
