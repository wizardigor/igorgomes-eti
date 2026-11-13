export const fonts={
 hand:'"Comic Sans MS","Segoe Print",cursive',sans:'Arial,sans-serif',serif:'Georgia,serif',
 rounded:'"Trebuchet MS",Verdana,sans-serif',humanist:'Verdana,Geneva,sans-serif',
 classic:'"Times New Roman",serif',mono:'"Courier New",monospace',display:'Impact,"Arial Black",sans-serif'
};
export const shapes={
 bulb:'M126 209 Q125 183 96 155 C57 112 82 49 131 33 C192 11 245 60 236 112 Q233 138 209 160 Q189 182 191 209 Z M134 230 H183 M141 252 H177 M158 208 V124 M139 116 L158 132 L178 116 M58 57 L38 37 M260 57 L280 37 M158 13 V4 M53 117 H29 M265 117 H289',
 rectangle:'M20 35 H300 V255 H20 Z',circle:'M160 20 A125 125 0 1 1 159.99 20 Z',
 triangle:'M160 24 L298 258 H22 Z',diamond:'M160 20 L300 145 L160 270 L20 145 Z',
 arrow:'M20 145 H297 M214 70 L297 145 L214 220',double:'M24 145 H296 M88 81 L24 145 L88 209 M232 81 L296 145 L232 209',
 star:'M160 20 L196 102 L287 108 L217 168 L239 258 L160 208 L81 258 L103 168 L33 108 L124 102 Z',
 wave:'M15 145 Q51 57 87 145 T159 145 T231 145 T303 145',
 zigzag:'M15 192 L63 97 L111 192 L159 97 L207 192 L255 97 L305 192',
 heart:'M160 253 C142 236 22 152 22 86 C22 28 106 13 160 80 C214 13 298 28 298 86 C298 152 178 236 160 253 Z',
 cloud:'M73 230 C8 227 5 143 60 129 C48 68 119 43 148 83 C178 27 262 43 264 107 C327 111 319 213 268 225 Z',
 check:'M47 152 L124 223 L274 65',
 speech:'M36 44 H284 Q304 44 304 64 V196 Q304 216 284 216 H117 L59 268 L69 216 H36 Q16 216 16 196 V64 Q16 44 36 44 Z'
};
export const effects=['draw','appear','fade','right','left','up','down','slide'];
const limit=(n,a,b)=>Math.max(a,Math.min(b,n));
export function cropRect(value){
 const v=Array.isArray(value)?value:[],n=(i,f)=>Number.isFinite(v[i])?v[i]:f;
 const x=limit(n(0,0),0,.95),y=limit(n(1,0),0,.95);
 return [x,y,limit(n(2,1),.05,1-x),limit(n(3,1),.05,1-y)];
}
export function entrance(effect,p,side,w,h){
 const q=1-(1-limit(p,0,1))**3;
 switch(effect){
 case 'right':return [-w*(1-q),0];
 case 'left':return [w*(1-q),0];
 case 'up':return [0,h*(1-q)];
 case 'down':return [0,-h*(1-q)];
 case 'slide':return [side*w*(1-q),0];
 default:return [0,0];
 }
}
