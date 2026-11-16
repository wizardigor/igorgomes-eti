import {day,iso} from './holidays.mjs';
const pairs=Array.from({length:7},(_,a)=>Array.from({length:6-a},(_,b)=>[a,a+b+1])).flat();
export function flexible(c,team,rules,seed){
 if(!c.rotateSunday||c.mode!=='days'||c.on!==5||c.off!==2||team.length>30)return null;
 const n=team.length, first=(new Date(c.start).getUTCDay()+6)%7, weeks=[], months=new Map();
 const ids=Array.from({length:n},(_,i)=>i);
 let state=seed>>>0||1234567;
 const rand=k=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)%k;};
 const shuffle=list=>{const a=list.slice();for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
 for(let base=-first;base<c.days;base+=7){
  const w=Array.from({length:7},(_,k)=>{
   const d=base+k, real=d>=0&&d<c.days, date=iso(c.start+d*day), weekday=(k+1)%7;
   const forced=real?ids.filter(i=>!team[i].allowed[weekday]):[];
   const r=real?(c.dateRules?.[date]??rules[weekday]):null;
   return {d,real,forced,min:Math.max(forced.length,r?.exact?r.value:0),max:r?.value??n,date};
  });
  if(w.some(x=>x.min>x.max||x.max>n)||w.reduce((s,x)=>s+x.min,0)>2*n||w.reduce((s,x)=>s+x.max,0)<2*n)return null;
  const sun=w[6];sun.low=Math.max(sun.min,2*n-w.slice(0,6).reduce((s,x)=>s+x.max,0));
  sun.high=Math.min(sun.max,2*n-w.slice(0,6).reduce((s,x)=>s+x.min,0));
  if(sun.real&&c.sunday){const key=sun.date.slice(0,7);if(!months.has(key))months.set(key,[]);months.get(key).push(sun);}
  weeks.push(w);
 }
 const deadline=Date.now()+650;
 for(let attempt=0;attempt<96&&Date.now()<deadline;attempt++){
  const selected=new Map();
  for(const w of weeks){const sun=w[6];selected.set(sun,{qty:sun.low,off:new Set(sun.forced)});}
  let impossible=false;
  for(const sundays of months.values()){
   for(let missing=n-sundays.reduce((s,d)=>s+selected.get(d).qty,0);missing>0;missing--){
    const open=sundays.filter(d=>selected.get(d).qty<d.high);
    if(!open.length){impossible=true;break;}
    selected.get(open[rand(open.length)]).qty++;
   }
   if(impossible)break;
   const frequency=ids.map(i=>sundays.filter(d=>d.forced.includes(i)).length);
   for(const sun of shuffle(sundays)){
    const {qty,off}=selected.get(sun);
    for(const i of shuffle(ids).sort((a,b)=>frequency[a]-frequency[b])){
     if(off.size===qty)break;
     if(!off.has(i)){off.add(i);frequency[i]++;}
    }
   }
   if(frequency.includes(0)){impossible=true;break;}
  }
  if(impossible)continue;
  const bits=ids.map(()=>new Uint8Array(c.days).fill(1)), streak=ids.map(()=>0);
  for(const w of weeks){
   const sun=selected.get(w[6]), quota=w.map((x,k)=>k===6?sun.qty:x.min);
   for(let need=2*n-quota.reduce((a,b)=>a+b,0);need;need--){
    const open=quota.map((v,k)=>k<6&&v<w[k].max?k:-1).filter(k=>k>=0);
    quota[open[rand(open.length)]]++;
   }
   const fixedSunday=c.sunday&&w[6].real;
   const order=shuffle(ids).map(i=>{
    const opts=shuffle(pairs).filter(([a,b])=>{
     if(fixedSunday&&(b===6)!==sun.off.has(i))return false;
     let run=streak[i];
     return w.every((x,k)=>{
      const off=k===a||k===b;
      if(!off&&x.forced.includes(i))return false;
      if(x.real)run=off?0:run+1;
      return !c.weekly||run<7;
     });
    });
    return {i,opts};
   }).sort((a,b)=>a.opts.length-b.opts.length);
   let calls=0;const chosen=[];
   function search(index){
    if(index===n)return true;
    if(++calls>4500||Date.now()>deadline)return false;
    for(let k=0;k<7;k++)if(quota[k]>order.slice(index).filter(o=>o.opts.some(p=>p.includes(k))).length)return false;
    for(const [a,b] of order[index].opts)if(quota[a]&&quota[b]){
     quota[a]--;quota[b]--;chosen[index]=[a,b];
     if(search(index+1))return true;
     quota[a]++;quota[b]++;
    }
    return false;
   }
   if(!search(0)){impossible=true;break;}
   order.forEach(({i},j)=>w.forEach(({d,real},k)=>{if(real){if(chosen[j].includes(k)){bits[i][d]=0;streak[i]=0;}else streak[i]++;}}));
  }
  if(impossible)continue;
  const counts=Array.from({length:c.days},(_,d)=>bits.reduce((s,b)=>s+b[d],0));
  const repeatedSundays=[...months.values()].reduce((s,ds)=>s+ds.reduce((a,d)=>a+n-counts[d.d],0)-n,0);
  return {choices:bits.map(bits=>({bits,shifts:Array.from(bits,v=>v?['Trabalho']:[])})),counts,repeatedSundays,sundaySearchLimited:false};
 }
 return null;
}
