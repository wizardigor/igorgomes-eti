export const day=86400000;
export const iso=t=>new Date(t).toISOString().slice(0,10);
function easter(y){
 const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),j=h+l-7*m+114;
 return Date.UTC(y,Math.floor(j/31)-1,j%31+1);
}
const national=[['01-01','Confraternização Universal'],['04-21','Tiradentes'],['05-01','Dia do Trabalho'],['09-07','Independência do Brasil'],['10-12','Nossa Senhora Aparecida'],['11-02','Finados'],['11-15','Proclamação da República'],['12-25','Natal']];
export function holidays(start,days,{nationalOn=true,uf='',city=''}={}){
 const map=new Map(),add=(date,name,scope)=>{const t=Date.parse(date+'T00:00:00Z');if(t>=start&&t<start+days*day){const old=map.get(date);map.set(date,{date,name:old&&old.name!==name?old.name+' / '+name:name,scope:old&&old.scope!==scope?old.scope+' / '+scope:scope});}};
 if(!Number.isFinite(start)||!Number.isInteger(days)||days<1||days>62)return [];
 const fort=uf.toUpperCase()==='CE'&&city.trim().toLowerCase()==='fortaleza';
 for(let y=new Date(start).getUTCFullYear();y<=new Date(start+(days-1)*day).getUTCFullYear();y++){
  if(nationalOn){for(const [md,name] of national)add(y+'-'+md,name,'Nacional');if(y>=2024)add(y+'-11-20','Consciência Negra','Nacional');add(iso(easter(y)-2*day),'Paixão de Cristo','Calendário federal');}
  if(uf.toUpperCase()==='CE')add(y+'-03-25','Data Magna do Ceará','Estadual');
  if(fort){add(y+'-03-19','São José','Municipal');add(y+'-08-15','Nossa Senhora da Assunção','Municipal');add(iso(easter(y)-2*day),'Paixão de Cristo','Municipal');add(iso(easter(y)+60*day),'Corpus Christi','Municipal');if(y===2026)add('2026-04-13','Tricentenário de Fortaleza','Municipal');}
 }
 return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
