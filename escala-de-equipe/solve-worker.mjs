import {flexible} from './flexible.mjs?v=dezembro';
import {solve} from './engine.mjs?v=variacao';
import {suggest} from './suggestion.mjs?v=variacao';
import {vary} from './variation.mjs?v=variacao';
self.onmessage=({data:[c,team,rules,seed,previous]})=>{
 try{
  if(previous){self.postMessage(vary(c,team,previous,seed,true)??{unchanged:true});return;}
  const out=flexible(c,team,rules,seed)??solve(c,team,rules);
  if(!out.error){self.postMessage(vary(c,team,out,seed));return;}
  const suggestion=suggest(c,team,rules);
  if(suggestion)suggestion.solution=vary(c,team,suggestion.solution,seed);
  self.postMessage({error:out.error,suggestion});
 }catch{self.postMessage({error:'Não foi possível processar as regras.'});}
};
