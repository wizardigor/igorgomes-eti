// A ponta da caneta é o ponto fixo ao mover ou girar a mão.
const models={
 masculina:{x:115/1312,y:161/1199},
 feminina:{x:114/1312,y:160/1199}
};
const sprites=new Map(),loading=new Map();
export const handModel=value=>Object.hasOwn(models,value)?value:'masculina';
export function loadHand(value){
 const model=handModel(value);
 if(loading.has(model))return loading.get(model);
 const image=new Image();
 const promise=new Promise(resolve=>{
  image.onload=()=>{sprites.set(model,image);resolve(true);};
  image.onerror=()=>{loading.delete(model);resolve(false);};
 });
 loading.set(model,promise);
 image.src=new URL('./hands/'+model+'.webp',import.meta.url).href;
 return promise;
}
export function drawWritingHand(ctx,x,y,angle,value,scale){
 const model=handModel(value),image=sprites.get(model);
 if(!image)return false;
 const {x:tipX,y:tipY}=models[model];
 const w=190/scale,h=w*image.naturalHeight/image.naturalWidth;
 ctx.save();
 ctx.translate(x,y);
 ctx.rotate(Math.sin(angle)*.12);
 ctx.drawImage(image,-tipX*w,-tipY*h,w,h);
 ctx.restore();
 return true;
}
