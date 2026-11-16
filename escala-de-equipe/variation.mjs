// Trade work and rest within the same week, keeping daily coverage and each person's weekly totals.
export function vary(c,people,schedule,seed,again=false){
 let state=seed>>>0||1;
 const random=n=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)%n;};
 const before=schedule.choices;
 const choices=before.map(o=>({...o,bits:o.bits.slice(),shifts:o.shifts.slice()}));
 const flexible=c.mode==='days'&&c.on===5&&c.off===2&&c.rotateSunday;
 const weekdays=Array.from({length:c.days},(_,d)=>new Date(c.start+d*86400000).getUTCDay());
 const weeks=[];
 for(let d=0;d<c.days;d++){
  if(d===0||weekdays[d]===1)weeks.push([]);
  if(weekdays[d]!==0)weeks.at(-1).push(d); // Keep each person's Sunday record intact.
 }
 const pairs=weeks.flatMap(w=>w.flatMap((a,i)=>w.slice(i+1).map(b=>[a,b])));
 const valid=bits=>{let run=0;for(const b of bits){run=b?run+1:0;if(c.weekly&&run>=7)return false;}return true;};
 const penalty=bits=>{
  let total=0;const seen=Array(7).fill(0);
  for(let d=0;d<c.days;d++)if(!bits[d]&&weekdays[d]){
   total+=seen[weekdays[d]]++*2;
   if(d>=7&&!bits[d-7])total+=3;
  }
  return total;
 };
 const differs=list=>list.some((o,i)=>o.bits.some((b,d)=>b!==before[i].bits[d]||o.shifts[d].join()!==before[i].shifts[d].join()));
 let best=null,bestScore=Infinity;
 if(!again){best=schedule;bestScore=choices.reduce((n,o)=>n+penalty(o.bits),0);}
 if(flexible&&pairs.length&&people.length>1){
  const costs=choices.map(o=>penalty(o.bits));let total=costs.reduce((a,b)=>a+b,0);
  for(let k=0;k<3200;k++){
   const i=random(people.length),j=random(people.length);if(i===j)continue;
   const [a,b]=pairs[random(pairs.length)],x=choices[i].bits,y=choices[j].bits;
   if(x[a]===y[a]||x[b]===y[b]||x[a]===x[b])continue;
   if(!people[i].allowed[weekdays[x[a]?b:a]]||!people[j].allowed[weekdays[y[a]?b:a]])continue;
   x[a]^=1;x[b]^=1;y[a]^=1;y[b]^=1;
   const cx=penalty(x),cy=penalty(y),delta=cx+cy-costs[i]-costs[j];
   const explore=k<2500&&random(100)<(delta<=4?15:3);
   if(!valid(x)||!valid(y)||(delta>0&&!explore)){x[a]^=1;x[b]^=1;y[a]^=1;y[b]^=1;continue;}
   for(const o of [choices[i],choices[j]])for(const d of [a,b])o.shifts[d]=o.bits[d]?['Trabalho']:[];
   total+=delta;costs[i]=cx;costs[j]=cy;
   if(total<bestScore&&differs(choices)){
    bestScore=total;best={...schedule,choices:choices.map(o=>({...o,bits:o.bits.slice(),shifts:o.shifts.slice()}))};
    if(total===0)break;
   }
  }
 }
 if(again&&!best){
  // For rigid cycles, exchange entire schedules only for people with identical availability.
  const key=p=>p.allowed.join()+':'+(p.time||c.time);
  const eligible=[];
  for(let i=0;i<people.length;i++)for(let j=i+1;j<people.length;j++)if(key(people[i])===key(people[j])&&before[i].shifts.some((s,d)=>s.join()!==before[j].shifts[d].join()))eligible.push([i,j]);
  if(eligible.length){const [i,j]=eligible[random(eligible.length)],next=before.slice();[next[i],next[j]]=[next[j],next[i]];best={...schedule,choices:next};}
 }
 return best;
}
