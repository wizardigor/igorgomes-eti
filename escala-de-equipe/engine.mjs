import {day,iso} from './holidays.mjs';
const mod=(a,b)=>(a%b+b)%b;
export function options({start,days,mode,on,off,time,rotateSunday,sunday},person){
 const period=on+off, hourly=mode==='hours', clock=person.time||time, [h,m]=clock.split(':').map(Number), base=h+m/60;
 const week=d=>new Date(start+d*86400000).getUTCDay();
 // Filter the actual visible shifts, including ones that cross midnight.
 const valid=[], full=person.allowed.every(Boolean);
 const phases=hourly&&on===12&&off===36?[0,24]:Array.from({length:period},(_,i)=>i);
 for(const p of phases){
  const bits=new Uint8Array(days), shifts=Array.from({length:days},()=>[]);
  let ok=true;
  if(hourly){
   const anchor=base+p, last=days*24, fmt=v=>String(Math.floor(v/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0');
   let s=anchor+Math.floor((-on-anchor)/period)*period;
   for(;s<last;s+=period){
    if(s+on<=0)continue;
    const first=Math.max(0,Math.floor(s/24)),end=Math.min(days,Math.ceil((s+on)/24));
    for(let d=first;d<end;d++){
     if(!person.allowed[week(d)]){ok=false;break;}
     const a=Math.round(Math.max(0,s-24*d)*60), b=Math.round(Math.min(24,s+on-24*d)*60);
     if(a<b){bits[d]=1;shifts[d].push(fmt(a)+'–'+fmt(b));}
    }
    if(!ok)break;
   }
  }else for(let d=0;d<days;d++){
   if(mod(d+p,period)>=on)continue;
   if(!full&&!person.allowed[week(d)]){ok=false;break;}
   bits[d]=1;shifts[d].push('Trabalho');
  }
  if(ok)valid.push({bits,shifts,p});
 }
 if(!hourly&&on===5&&off===2&&rotateSunday&&sunday){
  for(let a=0;a<7;a++)for(let b=a+1;b<7;b++){
   if(b===a+1||a===0&&b===6)continue; // Consecutive pairs are already covered by the regular cycle.
   const bits=Uint8Array.from({length:days},(_,d)=>Number(week(d)!==a&&week(d)!==b));
   if(bits.every((v,d)=>!v||person.allowed[week(d)]))valid.push({bits,shifts:Array.from(bits,v=>v?['Trabalho']:[]),p:null});
  }
 }
 return valid;
}
function sundaysByMonth(cfg){
 const months=new Map();
 if(cfg.sunday)for(let d=0;d<cfg.days;d++){
  const t=cfg.start+d*day,key=iso(t).slice(0,7);
  if(!months.has(key))months.set(key,[]);
  if(new Date(t).getUTCDay()===0)months.get(key).push(d);
 }
 return months;
}
export function restOptions(cfg,options,months=sundaysByMonth(cfg),allowed=[]){
 const out=[];
 for(const option of options){
  let variants=[option];
  for(const sundays of months.values()){
   variants=variants.flatMap(o=>{
    if(sundays.some(d=>!o.bits[d]))return [o];
    if(cfg.mode==='hours')return [];
    const variants=[];
    function move(base,d,target){
     // Transfer a regular day off within the same Monday–Sunday week.
     if(cfg.rotateSunday&&cfg.on===5&&cfg.off===2)for(let j=Math.max(0,d-6);j<d;j++){
      const weekday=new Date(cfg.start+j*day).getUTCDay();
      if(base.bits[j]||!allowed[weekday]||weekday===6)continue;
      const bits=base.bits.slice(),shifts=base.shifts.slice();
      bits[d]=0;shifts[d]=[];bits[j]=1;shifts[j]=['Trabalho'];
      target.push({...base,bits,shifts});
     }
    }
    for(const d of sundays){
     const moved=[];move(o,d,moved);variants.push(...moved);
     if(cfg.days<=35)for(const first of moved)for(const next of sundays)if(next>d)move(first,next,variants);
     if(cfg.extraSunday){
      const bits=o.bits.slice(),shifts=o.shifts.slice();bits[d]=0;shifts[d]=[];
      variants.push({...o,bits,shifts,extra:[...(o.extra||[]),d]});
     }
    }
    return variants;
   });
  }
  for(const o of variants){
   let streak=0,ok=true;
   if(cfg.weekly)for(const b of o.bits){streak=b?streak+1:0;if(streak>=7){ok=false;break;}}
   if(ok)out.push(o);
  }
 }
 return out;
}
export function solve(cfg,people,rules,budget=180000, timeLimit=2800){
 const days=cfg.days,n=people.length, months=sundaysByMonth(cfg), monthDays=[...months.values()], sundayDays=monthDays.flat();
 // Minimize repeated Sundays first, then avoid concentrating the repeats on one person.
 const weight=n*monthDays.reduce((sum,m)=>sum+m.length**2,0)+1;
 const cost=bits=>monthDays.reduce((sum,m)=>{const repeats=Math.max(0,m.filter(d=>!bits[d]).length-1);return sum+weight*repeats+repeats**2;},0);
 const groups=new Map(), domains=people.map(p=>{
  const key=p.allowed.map(Number).join('')+'|'+(p.time||cfg.time);
  if(!groups.has(key))groups.set(key,restOptions(cfg,options(cfg,p),months,p.allowed).map((o,rank)=>({...o,rank,cost:cost(o.bits)})));
  return groups.get(key);
 }), empty=people.filter((_,i)=>!domains[i].length).map(p=>p.name);
 if(empty.length)return {error:'Não há posição no ciclo compatível com os dias permitidos e as regras de descanso para: '+empty.join(', ')+'.'};
 const min=[],max=[];
 for(let d=0;d<days;d++){
  const r=cfg.dateRules?.[iso(cfg.start+d*day)]??rules[new Date(cfg.start+d*day).getUTCDay()];
  min[d]=n-(r?.value??n);max[d]=r?.exact?min[d]:n;
  if(min[d]<0)return {error:'Uma regra de folgas excede o total de funcionários.'};
 }
 if(cfg.mode==='days'&&cfg.on+cfg.off===7&&(!cfg.extraSunday||!cfg.sunday)){
  for(let d=0;d+7<=days;d++)if(new Date(cfg.start+d*day).getUTCDay()===1&&min.slice(d,d+7).reduce((a,b)=>a+b,0)===n*cfg.on){
   for(let j=d;j<d+7;j++)max[j]=min[j];
  }
 }
 for(let d=0;d+7<=days;d++){
  const needed=domains.reduce((sum,opts)=>sum+Math.min(...opts.map(o=>7-o.bits.slice(d,d+7).reduce((a,b)=>a+b,0))),0);
  const room=min.slice(d,d+7).reduce((sum,v)=>sum+n-v,0);
  if(needed>room)return {error:'Entre '+iso(cfg.start+d*day).split('-').reverse().join('/')+' e '+iso(cfg.start+(d+6)*day).split('-').reverse().join('/')+', o ciclo exige pelo menos '+needed+' folgas, mas os limites permitem apenas '+room+'. Aumente os limites ou mude o regime.'};
 }
 if(cfg.sunday){
  const capacity=new Map();
  for(let d=0;d<days;d++)if(new Date(cfg.start+d*day).getUTCDay()===0){
   const month=iso(cfg.start+d*day).slice(0,7);capacity.set(month,(capacity.get(month)||0)+n-min[d]);
  }
  for(const [month,room] of capacity)if(room<n)return {error:'Em '+month.split('-').reverse().join('/')+', os domingos do período oferecem apenas '+room+' vagas de folga para '+n+' pessoas. Inclua o mês inteiro ou aumente o limite de folgas no domingo.'};
 }
 const choices=Array(n).fill(null), counts=new Int16Array(days);
 let calls=0, expired=false,bestCost=Infinity,best=null;const deadline=Date.now()+timeLimit;
 const mandatoryRepeats=monthDays.reduce((sum,ds)=>sum+Math.max(0,ds.reduce((s,d)=>s+n-max[d],0)-n),0);
 const minimum=Math.max(mandatoryRepeats*(weight+1),domains.reduce((sum,opts)=>sum+opts.reduce((v,o)=>Math.min(v,o.cost),Infinity),0));
 function search(used=0){
  if(++calls>budget||Date.now()>deadline){expired=true;return false;}
  let bound=used;
  const lo=new Int16Array(days),hi=new Int16Array(days), live=[];
  for(let i=0;i<n;i++)if(!choices[i]){
   let lower=0;for(let j=0;j<i;j++)if(domains[j]===domains[i]&&choices[j])lower=Math.max(lower,choices[j].rank);
   const usable=domains[i].filter(o=>o.rank>=lower&&used+o.cost<bestCost&&o.bits.every((b,d)=>counts[d]+b<=max[d]));
   if(!usable.length)return false;
   bound+=usable.reduce((v,o)=>Math.min(v,o.cost),Infinity);if(bound>=bestCost)return false;
   live.push({i,usable});
   for(let d=0;d<days;d++){if(usable.some(o=>o.bits[d]))hi[d]++;if(usable.every(o=>o.bits[d]))lo[d]++;}
  }
  for(let d=0;d<days;d++)if(counts[d]+hi[d]<min[d]||counts[d]+lo[d]>max[d])return false;
  if(!live.length){bestCost=used;best={choices:choices.slice(),counts:[...counts]};return bestCost===minimum;}
  const {i,usable}=live.reduce((a,b)=>a.usable.length<=b.usable.length?a:b);
  const value=o=>o.bits.reduce((s,b,d)=>s+(b?Math.max(0,min[d]-counts[d])*10-counts[d]:0),0);
  const offLoad=o=>o.bits.reduce((s,b,d)=>s+(!b?(n-live.length-counts[d])*(sundayDays.includes(d)?2:1):0),0);
  const scores=new Map(usable.map(o=>[o,value(o)]));
  const loads=new Map(usable.map(o=>[o,offLoad(o)]));
  usable.sort((a,b)=>a.cost-b.cost||(a.extra?.length??0)-(b.extra?.length??0)||scores.get(b)-scores.get(a)||loads.get(a)-loads.get(b));
  for(const o of usable){
   choices[i]=o;for(let d=0;d<days;d++)counts[d]+=o.bits[d];
   if(search(used+o.cost))return true;
   for(let d=0;d<days;d++)counts[d]-=o.bits[d];
   choices[i]=null;if(expired)return false;
  }
  return false;
 }
 search();
 if(!best)return {error:expired?'A busca atingiu o limite sem confirmar uma escala. Reduza o período ou simplifique as restrições.':'Não existe escala que cumpra todas as regras neste período. Confira o regime, os dias permitidos e as folgas por dia.'};
 return {...best,repeatedSundays:Math.floor(bestCost/weight),sundaySearchLimited:cfg.sunday&&expired};
}
