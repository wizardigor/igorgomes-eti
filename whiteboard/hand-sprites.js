// Cada ferramenta tem um ponto de contato medido na imagem original.
const models={
 masculina:{ball:[115,161],eraser:[125,145],grip:[575,140],bic:[1069,120],quill:[48,730],fountain:[543,632],three:[1065,670],ink:[83,72]},
 feminina:{ball:[114,160],eraser:[116,145],grip:[578,155],bic:[1082,147],quill:[39,736],fountain:[549,655],three:[1069,681],ink:[1264,91]}
};
const cells={eraser:0,grip:1,bic:2,quill:3,fountain:4,three:5};
const images=new Map(),loading=new Map();
export const handModel=value=>Object.hasOwn(models,value)?value:'masculina';
function load(name){
 if(loading.has(name))return loading.get(name);
 const image=new Image();
 const promise=new Promise(resolve=>{
  image.onload=()=>{images.set(name,image);resolve(true);};
  image.onerror=()=>{loading.delete(name);resolve(false);};
 });
 loading.set(name,promise);
 image.src=new URL('./hands/'+name+'.webp',import.meta.url).href;
 return promise;
}
export function loadHand(value){
 const model=handModel(value);
 return Promise.all([load(model),load(model+'-ferramentas'),load('nanquim')]);
}
export function drawWritingHand(ctx,x,y,angle,value,scale,tool='ball',side=1){
 const model=handModel(value);
 if(!Object.hasOwn(models[model],tool))tool='ball';
 const image=images.get(tool==='ball'?model:tool==='ink'?'nanquim':model+'-ferramentas');
 if(!image)return false;
 let sx=0,sy=0,sw=1312,sh=1199,originalWidth=1312,originalHeight=1199;
 if(tool==='ink'){
  originalWidth=2172;originalHeight=sh=724;sw=1086;sx=model==='feminina'?1086:0;
 }else if(tool!=='ball'){
  const cell=cells[tool];originalWidth=1536;originalHeight=1024;sw=sh=512;sx=cell%3*sw;sy=Math.floor(cell/3)*sh;
 }
 const [tipX,tipY]=models[model][tool];
 const w=(tool==='eraser'?176:190)/scale,h=w*sh/sw;
 const rx=image.naturalWidth/originalWidth,ry=image.naturalHeight/originalHeight;
 ctx.save();
 ctx.translate(x,y);
 ctx.scale(side,1);
 ctx.rotate(Math.sin(angle)*.12);
 // Continue the wrist along its direction so its cut edge stays beyond the board.
 const wrist=tool==='ball'?(model==='masculina'?1164:1159):tool==='ink'?720:(sy?991:475)-sy;
 const left=-(tipX-sx)*w/sw,top=-(tipY-sy)*h/sh,edge=top+wrist*h/sh;
 if(typeof ctx.transform==='function'){
  ctx.save();
  ctx.transform(1,0,.55,1,left,edge);
  ctx.drawImage(image,sx*rx,(sy+wrist-5)*ry,sw*rx,5*ry,0,-1,w,1100/scale);
  ctx.restore();
 }
 ctx.drawImage(image,sx*rx,sy*ry,sw*rx,sh*ry,-(tipX-sx)*w/sw,-(tipY-sy)*h/sh,w,h);
 ctx.restore();
 return true;
}
