const files={gothic:['WB Gothic','UnifrakturCook-Bold.ttf'],trash:['WB Trash','RubikDirt-Regular.ttf'],terror:['WB Terror','Nosifer-Regular.ttf']};
const pending=new Map();
export function loadSpecialFont(id){
 if(!Object.hasOwn(files,id))return Promise.resolve(null);
 if(pending.has(id))return pending.get(id);
 const [family,file]=files[id],url=new URL('./fonts/'+file,import.meta.url);
 const task=new FontFace(family,'url("'+url.href+'")').load().then(face=>{document.fonts.add(face);return '"'+family+'"';}).catch(error=>{pending.delete(id);throw error;});
 pending.set(id,task);
 return task;
}
