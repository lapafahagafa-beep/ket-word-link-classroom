import {UNITS} from './words.ts';
import {partitionWords} from './grouping.ts';
const uid=()=>crypto.randomUUID(),now=()=>Date.now();
const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
class RestQuery {
 params=new URLSearchParams();method='GET';body:any;one=false;
 constructor(public table:string){}
 select(fields='*'){this.params.set('select',fields);return this}
 insert(body:any){this.method='POST';this.body=body;return this}
 update(body:any){this.method='PATCH';this.body=body;return this}
 delete(){this.method='DELETE';return this}
 eq(k:string,v:any){this.params.append(k,'eq.'+v);return this}
 gt(k:string,v:any){this.params.append(k,'gt.'+v);return this}
 is(k:string,v:any){this.params.append(k,'is.'+v);return this}
 not(k:string,op:string,v:any){this.params.append(k,'not.'+op+'.'+v);return this}
 limit(n:number){this.params.set('limit',String(n));return this}
 maybeSingle(){this.one=true;return this}
 single(){this.one=true;return this}
 async then(resolve:any,reject:any){try{const r=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/'+this.table+'?'+this.params,{method:this.method,headers:{apikey:secret,'Authorization':'Bearer '+Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),'Content-Type':'application/json','Prefer':'return=representation'},body:this.body===undefined?undefined:JSON.stringify(this.body)});const text=await r.text(),data=text?JSON.parse(text):null;return resolve(r.ok?{data:this.one?(Array.isArray(data)?data[0]||null:data):data,error:null}:{data:null,error:data})}catch(e){return reject(e)}}
}
const db={from:(name:string)=>new RestQuery(name)};
const shuffle=(a:any[])=>{a=[...a];for(let i=a.length-1;i>0;i--){const n=new Uint32Array(1);crypto.getRandomValues(n);const j=n[0]%(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
async function query(q:any){const r=await q;if(r.error)throw r.error;return r.data}
function view(a:any){const groups=a.data;return {id:a.id,unit:a.unit,section:a.section,next:a.next,groupCount:groups.length,total:a.total,correct:a.finished?a.correct:undefined,finished:a.finished,started:a.started,groupStarted:a.group_started,practice:false,group:a.finished?null:{answers:groups[a.next].answers||{},feedback:Object.fromEntries(groups[a.next].en.filter((x:any)=>groups[a.next].answers?.[x.id]).map((x:any)=>[x.id,groups[a.next].zh.find((z:any)=>z.id===groups[a.next].answers[x.id])?.label===x.zh])),en:groups[a.next].en.map((x:any)=>({id:x.id,label:x.label})),zh:groups[a.next].zh.map((x:any)=>({id:x.id,label:x.label}))},review:a.finished?groups.flatMap((g:any)=>g.en.map((w:any)=>({en:w.label,zh:w.zh,answer:g.answers?.[w.id]?g.zh.find((z:any)=>z.id===g.answers[w.id])?.label:'未作答',ok:g.answers?.[w.id]?g.zh.find((z:any)=>z.id===g.answers[w.id])?.label===w.zh:false}))):undefined}}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Access-Control-Allow-Origin':'https://lapafahagafa-beep.github.io','Access-Control-Allow-Headers':'content-type,apikey,x-ket-session,authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 const json=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&origin!=='https://lapafahagafa-beep.github.io')return json({error:'请从 GitHub 课堂页面进入'},403);
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return json({error:'请使用课堂页面'},405);
 try{
  const body=await req.text();if(body.length>16000)return json({error:'请求过大'},413);const b=JSON.parse(body);
  const token=req.headers.get('x-ket-session');let s:any=null;
  if(token&&/^[a-f0-9-]{36}$/.test(token)){const session=await query(db.from('ket_sessions').select('student_id').eq('id',token).gt('expires',now()).maybeSingle());if(session)s=await query(db.from('ket_students').select('id,name,class_name').eq('id',session.student_id).single())}
  if(b.action==='me')return json({teacher:false,student:s?{id:s.id,name:s.name,className:s.class_name}:null,units:UNITS.map(u=>({id:u.id,en:u.en,zh:u.zh,base:u.base.length,core:u.core.length}))});
  if(b.action==='login'){
   const name=String(b.name||'').normalize('NFKC').trim().replace(/\s+/g,' ');if(!name||name.length>40||/[\u0000-\u001f]/.test(name))return json({error:'请填写 1–40 字姓名'},400);
   const key=name.toLocaleLowerCase();let chosen=await query(db.from('ket_students').select('id').eq('name_key',key).maybeSingle());
   if(!chosen){const r=await db.from('ket_students').insert({name,name_key:key,created:now()}).select('id').single();if(r.error&&r.error.code!=='23505')throw r.error;chosen=r.data||await query(db.from('ket_students').select('id').eq('name_key',key).single())}
   const id=uid();await query(db.from('ket_sessions').insert({id,student_id:chosen.id,expires:now()+604800000}));return json({ok:true,sessionToken:id});
  }
  if(b.action==='logout'){if(s)await query(db.from('ket_sessions').delete().eq('id',token));return json({ok:true})}
  if(!s)return json({error:'请先填写姓名'},401);
  if(b.action==='progress')return json({records:(await query(db.from('ket_attempts').select('id,unit,section,correct,total,started,finished').eq('student_id',s.id))).map((a:any)=>({...a,correct:a.finished?a.correct:null}))});
  if(b.action==='leaderboard'){
   if(b.unit!=='all'&&!UNITS.some(u=>u.id===Number(b.unit)))return json({error:'请选择有效单元'},400);
   let q=db.from('ket_attempts').select('student_id,correct,total,unit,section,ket_students(id,name,class_name,created)').not('finished','is',null);
   if(b.unit!=='all')q=q.eq('unit',Number(b.unit));if(['base','core'].includes(b.section))q=q.eq('section',b.section);
   const rows=await query(q.limit(10000));const grouped=new Map();for(const r of rows){const person=r.ket_students as any;if(!person)continue;const a=grouped.get(r.student_id)||{...person,points:0,total:0,completed:0};a.points+=r.correct;a.total+=r.total;a.completed++;grouped.set(r.student_id,a)}
   const list=[...grouped.values()].sort((a,b)=>b.points-a.points||(b.points/b.total)-(a.points/a.total)||b.completed-a.completed||a.created-b.created);let rank=0,previous='';return json({ranking:list.map((r,i)=>{const tie=r.points+':'+r.total+':'+r.completed;if(tie!==previous){rank=i+1;previous=tie}return {id:r.id,name:r.name,class_name:r.class_name,points:r.points,total:r.total,completed:r.completed,rank,mine:r.id===s.id}})});
  }
  if(b.action==='start'){
   const unit=UNITS.find(u=>u.id===Number(b.unit)),section=b.section;if(!unit||!['base','core'].includes(section))return json({error:'单元不存在'},400);
   let a=await query(db.from('ket_attempts').select('*').eq('student_id',s.id).eq('unit',unit.id).eq('section',section).maybeSingle());if(a)return json(view(a));
   const words=shuffle((unit as any)[section]);if(!words.length)return json({error:'原书未设置此板块'},400);
   const groups=partitionWords(words,shuffle).map(list=>({en:shuffle(list.map(w=>({id:uid(),label:w[0],zh:w[1]}))),zh:shuffle(list.map(w=>({id:uid(),label:w[1]})))}));
   const r=await db.from('ket_attempts').insert({id:uid(),student_id:s.id,unit:unit.id,section,data:groups,total:words.length,started:now(),group_started:now()});if(r.error&&r.error.code!=='23505')throw r.error;
   a=await query(db.from('ket_attempts').select('*').eq('student_id',s.id).eq('unit',unit.id).eq('section',section).single());return json(view(a));
  }
  if(b.action==='pair'||b.action==='submit'){
   if(!/^[a-f0-9-]{36}$/.test(String(b.id)))return json({error:'无效练习'},400);
   for(let retry=0;retry<4;retry++){
    const a=await query(db.from('ket_attempts').select('*').eq('id',b.id).eq('student_id',s.id).maybeSingle());if(!a)return json({error:'找不到练习记录'},404);
    if(a.finished||b.next!==a.next)return json(b.action==='pair'?{attempt:view(a),replayed:true}:view(a));
    const g=a.data[a.next];let update:any;
    if(b.action==='pair'){
     const word=g.en.find((x:any)=>x.id===b.en),option=g.zh.find((x:any)=>x.id===b.zh);if(!word||!option)return json({error:'无效的连线选项'},400);g.answers=g.answers||{};
     if(g.answers[word.id])return json({attempt:view(a),ok:g.zh.find((z:any)=>z.id===g.answers[word.id]).label===word.zh,replayed:true});
     if(Object.values(g.answers).includes(option.id))return json({error:'这个中文已经连过'},409);
     g.answers[word.id]=option.id;update={data:a.data,revision:a.revision+1};
    }else{
     const ans=b.answers;if(!ans||Object.keys(ans).length!==g.en.length||new Set(Object.values(ans)).size!==g.zh.length||g.en.some((w:any)=>!g.answers?.[w.id]||g.answers[w.id]!==ans[w.id]))return json({error:'请完成全部连线，正式成绩只记录第一次选择'},400);
     const seconds=(now()-a.group_started)/1000;if(seconds<g.en.length*2)return json({error:`请认真检查，${Math.ceil(g.en.length*2-seconds)} 秒后可以提交`},400);
     const correct=g.en.filter((w:any)=>g.zh.find((z:any)=>z.id===ans[w.id]).label===w.zh).length;
     update={next:a.next+1,correct:a.correct+correct,group_started:now(),finished:a.next+1===a.data.length?now():null,fast:a.fast+(seconds<g.en.length*3?1:0),revision:a.revision+1};
    }
    const saved=await query(db.from('ket_attempts').update(update).eq('id',a.id).eq('student_id',s.id).eq('revision',a.revision).is('finished',null).select('*').maybeSingle());
    if(saved)return json(b.action==='pair'?{attempt:view(saved),ok:g.en.find((w:any)=>w.id===b.en).zh===g.zh.find((z:any)=>z.id===b.zh).label,replayed:false}:view(saved));
   }
   return json({error:'进度正在同步，请重新进入此板块继续'},409);
  }
  return json({error:'操作不存在'},400);
 }catch(e){console.error(e);return json({error:'暂时无法保存，请稍后重试；已保存记录不会丢失'},500)}
});

