import {monthLength} from './period.mjs?v=exportacao';
import {excelBytes} from './excel-export.mjs?v=exportacao';
import {holidays,day,iso} from './holidays.mjs';
const $=id=>document.getElementById(id);
const names=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],labels=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const order=[1,2,3,4,5,6,0], date=new Date();
$('start').value=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
let selectedMonth='';
function fillMonthLength(){
 const month=$('start').value.slice(0,7),length=monthLength($('start').value);
 if(length&&month!==selectedMonth){$('days').value=length;selectedMonth=month;}
}
fillMonthLength();
let people=[],result,revision=0;
let customDates={},dateRules={},hiddenDates={};
try{const saved=JSON.parse(localStorage.getItem('escala-feriados-v1')||'{}');customDates=saved.customDates||{};dateRules=saved.dateRules||{};hiddenDates=saved.hiddenDates||{};
 $('uf').dataset.saved=saved.uf||'';$('city').value=saved.city||'';$('national').checked=saved.national!==false;
}catch{}
for(const uf of 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '))$('uf').add(new Option(uf,uf));
$('uf').value=$('uf').dataset.saved||'';
function storeDates(){try{localStorage.setItem('escala-feriados-v1',JSON.stringify({customDates,dateRules,hiddenDates,uf:$('uf').value,city:$('city').value,national:$('national').checked}));}catch{}}
function calendar(c=config()){
 if(!Number.isFinite(c.start)||!Number.isInteger(c.days)||c.days<1||c.days>62)return [];
 const map=new Map(holidays(c.start,c.days,{nationalOn:$('national').checked,uf:$('uf').value,city:$('city').value}).filter(x=>!hiddenDates[x.date]).map(x=>[x.date,x]));
 for(const [key,v] of Object.entries(customDates))if(key>=iso(c.start)&&key<=iso(c.start+(c.days-1)*day))map.set(key,v);
 return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
function showHolidays(){
 const list=calendar(),body=$('holiday-list');body.replaceChildren();
 if(!list.length){const a=el('tr'),b=el('td','Nenhuma data especial neste período.');b.colSpan=4;a.append(b);body.append(a);}
 for(const holiday of list){
  const {date,name,scope}=holiday,row=el('tr'),label=el('td',date.split('-').reverse().join('/')+' · '+name+' ('+scope+')'),qty=el('input'),kind=el('select'),del=el('button','Remover');
  Object.assign(qty,{type:'number',min:0,max:80,value:dateRules[date]?.value??'',placeholder:'—'});qty.setAttribute('aria-label','Folgas em '+date);
  kind.append(new Option('Até','max'),new Option('Exato','exact'));kind.value=dateRules[date]?.exact?'exact':'max';kind.setAttribute('aria-label','Tipo de regra em '+date);
  const update=()=>{dateRules[date]={value:qty.value,exact:kind.value==='exact'};storeDates();invalidate();};qty.oninput=kind.onchange=update;
  del.className='ghost';del.onclick=()=>{delete customDates[date];delete dateRules[date];hiddenDates[date]=true;storeDates();showHolidays();invalidate();$('holiday-status').textContent='Data removida. Você pode adicioná-la novamente.';};
  row.append(label);for(const control of [qty,kind,del]){const td=el('td');td.append(control);row.append(td);}body.append(row);
 }
}
$('add-holiday').onsubmit=e=>{e.preventDefault();const date=$('holiday-date').value,name=$('holiday-name').value.trim();if(!date||!name)return;
 customDates[date]={date,name,scope:$('holiday-scope').value};delete hiddenDates[date];storeDates();showHolidays();invalidate();
 const visible=calendar().some(h=>h.date===date);$('holiday-status').textContent=visible?'Data adicionada. Preencha a quantidade se quiser substituir a regra semanal.':'Data guardada. Para editá-la, inclua-a no período da escala.';$('holiday-name').value='';
};
for(const id of ['uf','city','national'])$(id).addEventListener(id==='city'?'input':'change',()=>{storeDates();showHolidays();invalidate();});

const el=(tag,str)=>{const a=document.createElement(tag);if(str!=null)a.textContent=str;return a;};
function invalidate(){revision++;result=null;$('alternative').hidden=true;$('use-alternative').onclick=null;$('result').hidden=true;$('status').textContent='';}
for(const k of order){
 const label=el('label',labels[k]),row=el('div');row.className='rule';label.htmlFor='n'+k;
 const num=el('input');Object.assign(num,{id:'n'+k,type:'number',min:0,max:80,placeholder:'—'});num.setAttribute('aria-label','Folgas: '+labels[k]);
 const sel=el('select');sel.id='r'+k;sel.setAttribute('aria-label','Tipo de limite: '+labels[k]);sel.append(new Option('Até','max'),new Option('Exato','exact'));row.append(label,num,sel);$('rules').append(row);
}
function config(){
 const [a,b,u]=$('regime').value==='custom'?[$('on').value,$('off').value,$('unit').value]:$('regime').value.split(',');
 return {start:Date.parse($('start').value+'T00:00:00Z'),days:+$('days').value,mode:u==='h'?'hours':'days',on:+a,off:+b,time:$('time').value,weekly:$('weekly').checked,sunday:$('sunday').checked,extraSunday:$('extra-sunday').checked,rotateSunday:$('rotate-sunday').checked};
}
function sync(){const c=config();$('rotate-box').hidden=!(c.mode==='days'&&c.on===5&&c.off===2);$('extra-box').hidden=!c.sunday||c.mode==='hours';$('custom').hidden=$('regime').value!=='custom';$('timebox').hidden=c.mode!=='hours';$('cycle-note').textContent=c.mode==='hours'?(c.on===12&&c.off===36?'Plantões alternados a cada 48 horas, no horário de referência.':'Ciclo contínuo em horas. O gerador pode iniciar o primeiro turno em outro horário para cumprir as regras.'):'Os funcionários podem começar em pontos diferentes do ciclo. No 5 × 2, o rodízio pode variar os dias de folga entre as semanas e trocar uma folga pelo domingo.';}
function person(name){return {name,allowed:Array(7).fill(true)};}
function renderPeople(){
 const body=$('people');body.replaceChildren();$('team-count').textContent='· '+people.length;
 if(!people.length){const row=el('tr'),td=el('td','Adicione um nome ou importe uma planilha.');td.colSpan=9;row.append(td);body.append(row);return;}
 for(const p of people){
  const row=el('tr'),cell=el('td'),input=el('input');input.value=p.name;input.maxLength=100;input.setAttribute('aria-label','Nome: '+p.name);input.onchange=()=>{p.name=input.value.trim()||p.name;input.value=p.name;invalidate();};cell.append(input);row.append(cell);
  for(const k of order){const td=el('td'),label=el('label',names[k]),box=el('input');box.type='checkbox';box.checked=p.allowed[k];box.setAttribute('aria-label',p.name+' pode trabalhar: '+labels[k]);box.onchange=()=>{p.allowed[k]=box.checked;invalidate();};label.prepend(box);td.append(label);row.append(td);}
  const td=el('td'),del=el('button','Remover');del.className='ghost';del.onclick=()=>{people=people.filter(v=>v!==p);invalidate();renderPeople();};td.append(del);row.append(td);body.append(row);
 }
}
$('add').onsubmit=e=>{e.preventDefault();const name=$('name').value.trim();if(!name)return;if(people.length>=80){status('Limite de 80 funcionários por escala.',true);return;}people.push(person(name));$('name').value='';invalidate();renderPeople();};
$('example').onclick=()=>{
 if(people.length&&!confirm('Substituir a equipe atual pelos 7 nomes fictícios?'))return;
 people=['Ana','Bruno','Carla','Diego','Elisa','Felipe','Gabriela'].map(person);
 for(let k=0;k<7;k++){$('n'+k).value='';$('r'+k).value='max';}
 for(const [k,v] of [[5,0],[6,1]]){$('n'+k).value=v;$('r'+k).value='exact';}
 $('regime').value='5,2,d';sync();invalidate();renderPeople();$('import-status').textContent='Exemplo carregado: na sexta todos trabalham, no sábado folga uma pessoa.';
};
document.addEventListener('input',e=>{if(e.target.closest('.layout')){if(e.target.id==='start')fillMonthLength();sync();invalidate();if(['start','days'].includes(e.target.id))showHolidays();}});
function save(blob,name){const a=el('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('template').onclick=()=>save(new Blob(['\uFEFFNome;Seg;Ter;Qua;Qui;Sex;Sáb;Dom\r\nAna;Sim;Sim;Sim;Sim;Sim;Não;Não\r\n'],{type:'text/csv;charset=utf-8'}),'modelo-funcionarios.csv');
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
$('import').onchange=async e=>{
 const f=e.target.files[0];e.target.value='';if(!f)return;
 try{
  if(f.size>5*1024*1024)throw Error('Use um arquivo de até 5 MB.');
  if(!window.XLSX)throw Error('A leitura de planilhas não carregou. Reabra a página.');
  const data=/\.csv$/i.test(f.name)?await f.text():new Uint8Array(await f.arrayBuffer());
  const book=XLSX.read(data,{type:typeof data==='string'?'string':'array',sheetRows:102,sheets:0,raw:true});
  const rows=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:'',blankrows:false});
  if(!rows.length)throw Error('A primeira aba está vazia.');
  const header=rows[0].map(norm),nameCol=header.findIndex(v=>['nome','funcionario','colaborador','name'].includes(v.split(' ')[0]));
  const added=(nameCol>=0?rows.slice(1):rows).filter(r=>String(r[Math.max(0,nameCol)]??'').trim()).map(r=>{
   const p=person(String(r[Math.max(0,nameCol)]).trim().slice(0,100));
   if(nameCol>=0)for(let k=0;k<7;k++){const i=header.findIndex(h=>h.slice(0,3)===norm(names[k]));if(i>=0)p.allowed[k]=!['nao','0','false','n'].includes(norm(r[i]));}
   return p;
  });
  if(!added.length)throw Error('Nenhum nome encontrado. Use a coluna Nome ou coloque os nomes na primeira coluna.');
  if(people.length+added.length>80)throw Error('A importação passaria do limite de 80 funcionários.');
  people.push(...added);invalidate();renderPeople();$('import-status').textContent=added.length+' funcionário(s) importado(s) da primeira aba.';
 }catch(err){$('import-status').textContent=err.message;}
};
function status(s,error=false){$('status').textContent=s;$('status').dataset.error=String(error);}
function run(c,team,rules,previous){return new Promise((resolve,reject)=>{const w=new Worker('./solve-worker.mjs?v=dezembro',{type:'module'}),timer=setTimeout(()=>{w.terminate();reject(Error('A busca excedeu o tempo. Tente um período menor.'));},12000);w.onmessage=e=>{clearTimeout(timer);w.terminate();resolve(e.data);};w.onerror=()=>{clearTimeout(timer);w.terminate();reject(Error('Não foi possível iniciar o cálculo. Reabra a página.'));};w.postMessage([c,team,rules,crypto.getRandomValues(new Uint32Array(1))[0],previous]);});}
$('again').onclick=async()=>{
 if(!result)return;
 const token=revision,old=result,b=$('again'),generate=$('generate'),notice=$('again-status');
 b.disabled=generate.disabled=true;notice.textContent='Buscando outra distribuição com as mesmas regras…';
 try{
  const {c,team,holidays,choices,counts,repeatedSundays,sundaySearchLimited}=old;
  const out=await run(c,team,null,{choices,counts,repeatedSundays,sundaySearchLimited});
  if(token!==revision)return;
  if(out.error||out.unchanged){notice.textContent=out.error||'Não foi encontrada outra combinação com estas regras. A escala atual foi mantida.';return;}
  result={c,team,holidays,...out};show();notice.textContent='Outra distribuição gerada com as mesmas regras.';
 }catch(e){if(token===revision)notice.textContent=e.message;}
 finally{b.disabled=generate.disabled=false;}
};
$('generate').onclick=async()=>{
 invalidate();const token=revision,c=config(),b=$('generate');
 if(!people.length)return status('Adicione funcionários antes de gerar.',true);
 if(!Number.isFinite(c.start)||!Number.isInteger(c.days)||c.days<1||c.days>62)return status('Informe a data inicial e um período de 1 a 62 dias.',true);
 if(!Number.isInteger(c.on)||!Number.isInteger(c.off)||c.on<1||c.off<1||c.on+c.off>(c.mode==='hours'?168:42)||c.mode==='hours'&&!/^\d\d:\d\d$/.test(c.time))return status('Confira o horário e o ciclo: até 42 dias ou 168 horas somando trabalho e descanso.',true);
 const rules=names.map((_,k)=>$('n'+k).value===''?null:{value:+$('n'+k).value,exact:$('r'+k).value==='exact'});
 for(let k=0;k<7;k++)if(rules[k]&&(!Number.isInteger(rules[k].value)||rules[k].value<0||rules[k].value>people.length))return status('Confira a regra de '+labels[k].toLowerCase()+': use de 0 a '+people.length+' folgas.',true);
 const holidays=calendar(c);c.dateRules={};
 for(const {date} of holidays){const r=dateRules[date];if(!r||r.value==='')continue;const n=Number(r.value);if(!Number.isInteger(n)||n<0||n>people.length)return status('Confira o número de folgas para '+date.split('-').reverse().join('/')+'.',true);c.dateRules[date]={value:n,exact:r.exact};}
 if(c.sunday){const months=new Map();for(let d=0;d<c.days;d++){const t=c.start+d*day,key=iso(t).slice(0,7);months.set(key,months.get(key)||new Date(t).getUTCDay()===0);}const missing=[...months].filter(([,ok])=>!ok);if(missing.length)return status('Inclua um domingo no trecho de cada mês para aplicar a regra mensal.',true);}
 const team=structuredClone(people);b.disabled=true;status('Buscando uma combinação de ciclos…');
 try{
  const out=await run(c,team,rules);
  if(token!==revision)return;
  if(out.error){
   status(out.error,true);
   if(!out.suggestion){status(out.error+' Não encontramos uma alternativa alterando só os limites de folga. Confira também o período e os dias permitidos.',true);return;}
   const {changes,solution}=out.suggestion,format=r=>(r.exact?'Exatamente ':'Até ')+r.value;
   $('alternative-changes').replaceChildren(...changes.map(x=>el('li',(x.date?x.date.split('-').reverse().join('/'):labels[x.weekday])+': '+format(x.before)+' → '+format(x.after)+' folga(s).')));
   $('alternative').hidden=false;
   $('use-alternative').onclick=()=>{
    if(token!==revision)return;
    for(const {date,weekday,after} of changes){
     if(date){dateRules[date]={value:String(after.value),exact:after.exact};c.dateRules[date]=after;}
     else{$('n'+weekday).value=after.value;$('r'+weekday).value=after.exact?'exact':'max';}
    }
    storeDates();showHolidays();invalidate();result={c,team,holidays,...solution};show();status('Escala alternativa aplicada com os limites mostrados acima.');
   };return;
  }
  result={c,team,holidays,...out};show();status('Escala pronta.');
 }catch(e){if(token===revision)status(e.message,true);}finally{b.disabled=false;}
};
function show(){
 $('again-status').textContent='';
 const {c,team,counts,choices,holidays}=result;const byDate=new Map(holidays.map(h=>[h.date,h]));
 const dates=counts.map((_,d)=>new Date(c.start+d*86400000));
 const title=dt=>names[dt.getUTCDay()]+' '+dt.toLocaleDateString('pt-BR',{timeZone:'UTC',day:'2-digit',month:'2-digit'});
 result.rows=[['Funcionário',...dates.map(d=>{const h=byDate.get(iso(d));return title(d)+(h?' · '+h.name:'');})],...team.map((p,i)=>[p.name,...choices[i].shifts.map((s,d)=>s.join(' / ')||(choices[i].extra?.includes(d)?'Folga extra':'Folga'))]),['Trabalham',...counts],['Folgam',...counts.map(n=>team.length-n)]];
 const table=$('schedule');table.replaceChildren();
 for(let i=0;i<result.rows.length;i++){
  const tr=el('tr');result.rows[i].forEach((val,j)=>{const td=el(i===0||j===0?'th':'td',val);if(i===0&&j&&[0,6].includes(dates[j-1].getUTCDay()))td.className='weekend';if(i===0&&j&&byDate.has(iso(dates[j-1]))){const h=byDate.get(iso(dates[j-1]));td.className='holiday';td.textContent=title(dates[j-1]);td.append(el('small',h.name));td.title=h.scope;}if(i>0&&i<=team.length&&j)td.className=String(val).startsWith('Folga')?'off':'work';tr.append(td);});table.append(tr);
 }
 $('summary').textContent=team.length+' pessoas · '+c.days+' dias · '+c.on+' × '+c.off+(c.mode==='hours'?' horas':' dias');
 if(c.sunday)$('summary').textContent+=' · '+(result.repeatedSundays===0?'Um domingo de folga por pessoa em cada mês do período.':result.repeatedSundays+' folga(s) de domingo além da primeira por pessoa no mês.'+(result.sundaySearchLimited?' A busca não confirmou se é possível reduzir esse número.':''));
 $('result').hidden=false;$('result').scrollIntoView({block:'start'});
}
$('csv').onclick=()=>{if(!result)return;const rows=result.rows.map(row=>row.map(v=>{let s=String(v);if(/^[\s\uFEFF]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(';')).join('\r\n');save(new Blob(['\uFEFF'+rows],{type:'text/csv;charset=utf-8'}),'escala.csv');};
$('excel').onclick=()=>{
 if(!result)return;
 if(!window.XLSX){$('again-status').textContent='Excel indisponível neste momento. Baixe o CSV.';return;}
 try{save(new Blob([excelBytes(window.XLSX,result)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'escala.xlsx');}
 catch{$('again-status').textContent='Não foi possível exportar a planilha. Tente novamente ou baixe o CSV.';}
};
$('pdf').onclick=async()=>{
 if(!result)return;
 const data=result,b=$('pdf'),notice=$('again-status');
 const name=$('pdf-company').value,file=$('pdf-company-logo').files[0];
 if(file?.size>2*1024*1024){notice.textContent='A logo da empresa deve ter até 2 MB.';return;}
 notice.textContent='';b.disabled=true;
 try{
  const [module,image]=await Promise.all([import('./calendar-export.mjs?v=marca'),fetch('./assinatura.png')]);
  if(!image.ok)throw Error();
  const companyLogo=file?await file.arrayBuffer():null;
  save(new Blob([await module.calendarBytes(data,await image.arrayBuffer(),{name,companyLogo})],{type:'application/pdf'}),'calendario-de-folgas.pdf');
 }catch(error){notice.textContent=error.message?.startsWith('Use uma imagem')?error.message:'Não foi possível baixar o calendário em PDF. Tente novamente.';}
 finally{b.disabled=false;}
};
$('print').onclick=()=>window.print();
renderPeople();sync();showHolidays();
