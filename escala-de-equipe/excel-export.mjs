// SheetJS writes the data; add the visual styles to its two OOXML parts.
export function excelBytes(XLSX,{rows,c,team,holidays}){
 const sheet=XLSX.utils.aoa_to_sheet(rows), book=XLSX.utils.book_new();
 sheet['!cols']=[{wch:32},...rows[0].slice(1).map(s=>({wch:s.length>13?24:14}))];
 XLSX.utils.book_append_sheet(book,sheet,'Escala');
 const {CFB}=XLSX, zip=CFB.read(XLSX.write(book,{type:'base64',bookType:'xlsx'}),{type:'base64'});
 const edit=(path,fn)=>{
  const entry=CFB.find(zip,'/'+path);
  if(!entry)throw new Error('Estrutura da planilha indisponível.');
  entry.content=new TextEncoder().encode(fn(new TextDecoder().decode(Uint8Array.from(entry.content))));
  entry.size=entry.content.length;
 };
 const palette=[
  ['102D50','FFFFFF',true,'left'],['102D50','FFFFFF',true,'center'],
  ['E4EBFA','102D50',true,'left'],['F7EEE0','704F27',false,'center'],
  ['E7F0E7','245640',false,'center'],['F1E9DB','633D2C',true,'center'],
  ['F5E6B9','523E0F',true,'center'],['DFE9F5','102D50',true,'center']
 ];
 const wrap=(tag,defs)=>'<'+tag+' count="'+defs.length+'">'+defs.join('')+'</'+tag+'>';
 edit('xl/styles.xml',xml=>{
  const fonts=['<font><sz val="11"/><name val="Calibri"/></font>',...palette.map(([,color,bold])=>'<font>'+(bold?'<b/>':'')+'<sz val="11"/><color rgb="FF'+color+'"/><name val="Calibri"/></font>')];
  const fills=['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>',...palette.map(([color])=>'<fill><patternFill patternType="solid"><fgColor rgb="FF'+color+'"/><bgColor indexed="64"/></patternFill></fill>')];
  const xfs=['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',...palette.map(([, , ,align],i)=>'<xf numFmtId="0" fontId="'+(i+1)+'" fillId="'+(i+2)+'" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="'+align+'" vertical="center" wrapText="1"/></xf>')];
  for(const [tag,defs] of [['fonts',fonts],['fills',fills],['cellXfs',xfs]])xml=xml.replace(new RegExp('<'+tag+'\\b[^>]*>[\\s\\S]*?</'+tag+'>'),wrap(tag,defs));
  return xml;
 });
 const holidaysByDate=new Set(holidays.map(h=>h.date));
 edit('xl/worksheets/sheet1.xml',xml=>xml.replace(/<c\b([^>]*\br="([A-Z]+[0-9]+)"[^>]*)>/g,(_,attr,address)=>{
  const {r,col}=(()=>{const a=XLSX.utils.decode_cell(address);return {r:a.r,col:a.c};})();
  const dt=new Date(c.start+(col-1)*86400000);
  const style=r===0?(col===0?1:holidaysByDate.has(dt.toISOString().slice(0,10))?7:[0,6].includes(dt.getUTCDay())?6:2)
   :r>team.length?8:col===0?3:String(rows[r][col]).startsWith('Folga')?4:5;
  return '<c'+attr.replace(/\s+s="[^"]*"/,'')+' s="'+style+'">';
 }));
 return Uint8Array.from(CFB.write(zip,{fileType:'zip',type:'buffer',compression:true}));
}
