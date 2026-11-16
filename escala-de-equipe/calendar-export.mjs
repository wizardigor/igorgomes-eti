import {PDFDocument,StandardFonts,rgb} from './pdf-lib.mjs';
const day=86400000;
const monthLabel=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'});
const dateLabel=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeZone:'UTC'});
const weekdays=['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
const color=hex=>rgb(...hex.match(/../g).map(v=>parseInt(v,16)/255));
const navy=color('102D50'),violet=color('343D89'),ink=color('203652'),muted=color('566782'),
 white=color('FFFFFF'),border=color('D8E0EE'),weekend=color('F0EEFA'),outside=color('F3F5F8');

export async function calendarBytes({c,team,choices},logoBytes,{name,companyLogo}={}){
 const doc=await PDFDocument.create();
 doc.setTitle('Calendário de folgas');doc.setAuthor('Igor Gomes ETI');
 const regular=await doc.embedFont(StandardFonts.Helvetica), bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const logo=await doc.embedPng(logoBytes);
 let companyImage;
 if(companyLogo){
  const bytes=new Uint8Array(companyLogo), png=[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
  try{
   if(bytes.length>2*1024*1024||(!png&&!(bytes[0]===255&&bytes[1]===216)))throw Error();
   companyImage=png?await doc.embedPng(bytes):await doc.embedJpg(bytes);
  }catch{throw new Error('Use uma imagem PNG ou JPG válida, de até 2 MB, para a logo da empresa.');}
 }
 const W=841.89,H=595.28,M=32,cell=(W-2*M)/7,fontSize=8.2,leading=10.5,gridTop=456,gridBottom=53,room=gridTop-gridBottom;
 const supported=new Set(regular.getCharacterSet());
 let canvas,ctx;const raster=new Map();
 const needsImage=t=>typeof document!=='undefined'&&Array.from(t).some(ch=>!supported.has(ch.codePointAt(0)));
 const safe=t=>Array.from(t,ch=>supported.has(ch.codePointAt(0))?ch:'?').join('');
 function canvasContext(){if(!ctx){canvas=document.createElement('canvas');ctx=canvas.getContext('2d');}ctx.font=fontSize*3+'px Arial';return ctx;}
 const width=t=>needsImage(t)?canvasContext().measureText(t).width/3:regular.widthOfTextAtSize(safe(t),fontSize);
 function wrapName(name,maxWidth=cell-20){
  const rows=[];let line='';
  for(const word of name.replace(/\s+/g,' ').trim().split(' ')){
   const combined=line?line+' '+word:word;
   if(width(combined)<=maxWidth){line=combined;continue;}
   if(line)rows.push(line);line='';
   for(const ch of word){if(line&&width(line+ch)>maxWidth){rows.push(line);line='';}line+=ch;}
  }
  if(line)rows.push(line);return rows;
 }
 async function nameLine(page,t,x,y,size=fontSize){
  if(!needsImage(t)){page.drawText(safe(t),{x,y,size,font:regular,color:ink});return;}
  if(!raster.has(t)){
   const w=width(t)+2;canvas.width=Math.ceil(w*3);canvas.height=36;
   const context=canvasContext();context.fillStyle='#203652';context.textBaseline='alphabetic';context.fillText(t,0,27);
   raster.set(t,{image:await doc.embedPng(canvas.toDataURL('image/png')),w});
  }
  const {image,w}=raster.get(t), scale=size/fontSize;page.drawImage(image,{x,y:y-3*scale,width:w*scale,height:12*scale});
 }
 const end=c.start+(c.days-1)*day;
 const first=new Date(c.start);
 for(let y=first.getUTCFullYear(),m=first.getUTCMonth();Date.UTC(y,m,1)<=end;m++){
  if(m===12){m=0;y++;}
  const start=Date.UTC(y,m,1), offset=new Date(start).getUTCDay(), number=new Date(Date.UTC(y,m+1,0)).getUTCDate();
  const rows=[];
  for(let week=0;week<Math.ceil((number+offset)/7);week++){
   const cells=weekdays.map((_,i)=>{
    const n=week*7+i-offset+1;
    if(n<1||n>number)return {lines:[]};
    const t=start+(n-1)*day,inPeriod=t>=c.start&&t<=end,d=(t-c.start)/day;
    const lines=inPeriod?team.flatMap((p,j)=>choices[j].bits[d]?[]:wrapName(p.name)):[];
    return {n,inPeriod,lines};
   });
   const max=Math.max(...cells.map(v=>v.lines.length)), limit=32;
   for(let i=0;i<Math.max(1,max);i+=limit){
    const display=cells.map(v=>({...v,lines:v.lines.slice(i,i+limit),continued:i>0}));
    rows.push({height:Math.max(62,25+leading*Math.min(limit,max-i)),display});
   }
  }
  let page,top,part=0;
  async function newPage(){
   page=doc.addPage([W,H]);top=gridTop;part++;
   const text=(t,x,y,size,font=regular,color=ink)=>page.drawText(t,{x,y,size,font,color});
   page.drawRectangle({x:M,y:480,width:W-2*M,height:3,color:violet});
   text('ESCALA DE EQUIPE',M,552,10,bold,violet);
   text('Calendário de folgas',M,520,26,bold,navy);
   const month=monthLabel.format(start);
   text(month[0].toUpperCase()+month.slice(1)+(part>1?'  |  Continuação '+part:''),M,495,12,bold,ink);
   if(companyImage){
    const size=companyImage.scale(Math.min(115/companyImage.width,64/companyImage.height));
    page.drawImage(companyImage,{x:W-M-size.width,y:529-size.height/2,width:size.width,height:size.height});
   }
   if(name?.trim()){
    const maxWidth=companyImage?230:330,size=13,right=W-M-(companyImage?132:0);
    const lines=wrapName(name.trim().slice(0,80),maxWidth*fontSize/size);
    for(const [i,line] of lines.entries())await nameLine(page,line,right-width(line)*size/fontSize,529+(lines.length-1)*8-i*16,size);
   }
   for(const [i,label] of weekdays.entries()){
    const x=M+i*cell;page.drawRectangle({x,y:gridTop,width:cell,height:20,color:i===0||i===6?violet:navy,borderWidth:.3,borderColor:white});
    text(label,x+8,gridTop+6,9,bold,white);
   }
   page.drawLine({start:{x:M,y:43},end:{x:W-M,y:43},thickness:.75,color:border});
   text('Período: '+dateLabel.format(c.start)+' a '+dateLabel.format(end)+'  |  Dias em cinza: fora do período',M,27,8,regular,muted);
   const logoSize=logo.scale(Math.min(78/logo.width,25/logo.height));
   page.drawImage(logo,{x:W-M-logoSize.width,y:25-logoSize.height/2,width:logoSize.width,height:logoSize.height});
   const signatureX=W-M-logoSize.width-82;
   text('Igor Gomes ETI',signatureX,29,8,bold,navy);
   text('igorgomes.eti.br',signatureX,18,8,regular,muted);
  }
  for(const row of rows){
   if(!page||top-row.height<gridBottom)await newPage();
   for(const [i,d] of row.display.entries()){
    const x=M+i*cell;
    page.drawRectangle({x,y:top-row.height,width:cell,height:row.height,color:!d.inPeriod?outside:i===0||i===6?weekend:white,borderWidth:.55,borderColor:border});
    if(d.n&&(!d.continued||d.lines.length)){
     page.drawText(String(d.n)+(d.continued?' (cont.)':''),{x:x+8,y:top-15,size:9,font:bold,color:d.inPeriod?navy:muted});
     for(const [j,line] of d.lines.entries())await nameLine(page,line,x+8,top-28-j*leading);
    }
   }
   top-=row.height;
  }
 }
 return doc.save();
}
