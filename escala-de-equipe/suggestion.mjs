import {solve} from './engine.mjs?v=variacao';
import {day,iso} from './holidays.mjs';
const week=t=>new Date(t).getUTCDay();
export function suggest(cfg,people,rules){
 const total=people.length;
 for(const level of [1,2,total]){
  // Keep exact staffing requirements as long as a solution can be found with them.
  const relax=(r,k)=>!r?null:r.exact||k===5||k===6?r:{value:Math.min(total,r.value+level),exact:false};
  const next=rules.map(relax),overrides=Object.fromEntries(Object.entries(cfg.dateRules||{}).map(([k,v])=>[k,relax(v,week(Date.parse(k+'T00:00:00Z')))]));
  const out=solve({...cfg,dateRules:overrides},people,next,35000,950);
  if(!out.counts)continue;
  const weekly=Array.from({length:7},()=>[]),special={};
  out.counts.forEach((working,d)=>{
   const t=cfg.start+d*day,date=iso(t),off=total-working;
   if(Object.hasOwn(cfg.dateRules||{},date))special[date]=[off];
   else weekly[week(t)].push(off);
  });
  const change=(original,amounts)=>{
   if(!original||!amounts.length||amounts.every(n=>original.exact?n===original.value:n<=original.value))return null;
   if(original.exact&&amounts.every(n=>n===amounts[0]))return {before:original,after:{value:amounts[0],exact:true}};
   return {before:original,after:{value:Math.max(original.value,...amounts),exact:false}};
  };
  const changes=[];
  weekly.forEach((amounts,k)=>{const c=change(rules[k],amounts);if(c)changes.push({weekday:k,...c});});
  for(const [date,amounts] of Object.entries(special)){const c=change(cfg.dateRules[date],amounts);if(c)changes.push({date,...c});}
  if(changes.length)return {changes,solution:out};
 }
 return null;
}
