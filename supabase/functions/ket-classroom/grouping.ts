// Keep definitions with overlapping glosses apart where possible; identical
// translations remain interchangeable under server-side grading.
export function partitionWords(words:any[],shuffle:(a:any[])=>any[]){
 const n=Math.ceil(words.length/6),groups:any[][]=Array.from({length:n},()=>[]);
 const gloss=(s:string)=>new Set(s.split(/[；;]/).map(x=>x.trim()).filter(Boolean));
 for(const word of words){
  const candidates=shuffle(groups.map((g,i)=>({g,i}))).filter(x=>x.g.length < Math.floor(words.length/n)+(x.i<words.length%n?1:0));
  candidates.sort((a,b)=>{
   const conflict=(g:any[])=>g.filter(w=>w[1]!==word[1]&&[...gloss(w[1])].some(t=>gloss(word[1]).has(t))).length;
   return conflict(a.g)-conflict(b.g)||a.g.length-b.g.length;
  });
  candidates[0].g.push(word);
 }
 return groups.filter(g=>g.length);
}

