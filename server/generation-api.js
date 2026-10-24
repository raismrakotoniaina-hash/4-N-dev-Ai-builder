const COOKIE = 'builder_session';
// Developer-controlled orchestration: end users never select models.
const PIPELINE = Object.freeze({
 planner: '4n-chat-naya-6',
 plannerReview: '4n-chat-naya-5.6',
 coder: '4n-code-nael-6.1',
 codeReviewer: '4n-code-nael-5.6'
});
function cookieValue(header=''){for(const item of header.split(';')){const [key,...rest]=item.trim().split('=');if(key===COOKIE)return rest.join('=');}return null;}
function send(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload));}
function safePath(p){return typeof p==='string'&&p.length>0&&p.length<=240&&!p.startsWith('/')&&!p.includes('\\')&&!p.split('/').some(x=>!x||x==='.'||x==='..');}
function parseFiles(output){
 if(typeof output!=='string'||!output.trim())throw new Error('Core returned an empty generation result.');
 const normalized=output.trim().replace(/^`{3}(?:json)?\s*/i,'').replace(/\s*`{3}$/,''); let data;try{data=JSON.parse(normalized);}catch{throw new Error('AI output was not valid JSON. Retry generation.');}
 if(!Array.isArray(data?.files)||data.files.length<1||data.files.length>20)throw new Error('AI must return between 1 and 20 files.');
 const seen=new Set();let total=0;
 const files=data.files.map(f=>{if(!f||!safePath(f.path)||typeof f.content!=='string'||!f.content.trim()||seen.has(f.path)||f.content.length>500000)throw new Error('AI returned an invalid or duplicate file.');seen.add(f.path);total+=f.content.length;return {path:f.path,content:f.content};});
 if(total>900000||!files.some(f=>f.path==='package.json'))throw new Error('Generated files exceed limits or package.json is missing.');
 return files;
}
async function callCore(fetchImpl,base,key,service,body){
 let response;try{response=await fetchImpl(base.replace(/\/$/,'')+'/v1/'+service,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});}catch{const e=new Error('Could not reach 4N DEV Core.');e.statusCode=502;throw e;}
 const p=await response.json().catch(()=>({}));if(!response.ok||p.success!==true){const msg=typeof p.error==='string'?p.error:p.error?.message;const e=new Error(msg||p.message||'Core generation failed.');e.statusCode=response.status===401?401:response.status===402?402:response.status===429?429:response.status>=500?502:400;throw e;}return p;
}
export function createGenerationApi({store,fetchImpl=globalThis.fetch,coreApiUrl='https://api.4ndev.dev'}){
 return async function generationApi(req,res,url){
  const m=url.pathname.match(/^\/api\/projects\/([0-9a-f-]{36})\/generate$/i);if(!m||req.method!=='POST')return false;
  const user=await store.getUserForSession(cookieValue(req.headers.cookie));if(!user)return send(res,401,{success:false,error:'Authentication required.'});
  try{
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16000)return send(res,413,{success:false,error:'Generation request is too large.'});chunks.push(chunk);}
   let body;try{body=chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{};}catch{return send(res,400,{success:false,error:'Request body must be valid JSON.'});}
   const prompt=typeof body.prompt==='string'?body.prompt.trim():'';
   if(!prompt||prompt.length>12000)return send(res,400,{success:false,error:'Describe the app in 1–12,000 characters.'});
   const project=await store.getProject(user.id,m[1]);if(!project)return send(res,404,{success:false,error:'Project not found.'});
   const key=await store.getCoreKey(user.id);if(!key)return send(res,409,{success:false,error:'Connect a 4N DEV Core secret key in Settings first.'});
   const plan=await callCore(fetchImpl,coreApiUrl,key,'chat',{model:PIPELINE.planner,max_output_tokens:700,messages:[
    {role:'system',content:'You are the lead architect of a production web app builder. Convert the user request into a concise implementation plan. Identify pages, features, data entities, validation, security and responsive behavior. No source code.'},
    {role:'user',content:prompt}
   ]});
   const planReview=await callCore(fetchImpl,coreApiUrl,key,'chat',{model:PIPELINE.plannerReview,max_output_tokens:500,messages:[
    {role:'system',content:'Review the app plan for missing requirements, unsafe assumptions and implementation gaps. Return an improved concise plan only.'},
    {role:'user',content:'User request:\n'+prompt+'\n\nDraft plan:\n'+(plan.data?.message?.content||'')}
   ]});
   const codingPrompt=[
    'Generate a runnable multi-file React + TypeScript + Vite web app.',
    'Return ONLY valid JSON: {"files":[{"path":"package.json","content":"..."}]}. Content values must be JSON strings.',
    'Include package.json, index.html, src/main.tsx, src/App.tsx and src/index.css as appropriate.',
    'Responsive polished UI; complete imports and build scripts. No prose, secrets, node_modules or lockfiles. Max 20 files.',
    'Use only these preinstalled dependencies, with exact versions and no ranges, tags, URLs or wildcards: react 19.3.0, react-dom 19.3.0, vite 8.3.0, typescript 5.7.3, lucide-react 0.468.0, @vitejs/plugin-react 6.1.1, @types/react 19.3.0, @types/react-dom 19.3.0, @types/node 22.20.2.',
    'Do not add any other dependencies. Use browser APIs and CSS instead of uninstalled packages. Keep package.json dependencies and devDependencies pinned to the exact versions listed above.',
    'Project name: '+project.name,
    'Original user request:',prompt,
    'Implementation plan:',planReview.data?.message?.content||plan.data?.message?.content||''
   ].join('\n');
   const result=await callCore(fetchImpl,coreApiUrl,key,'coding',{model:PIPELINE.coder,language:'JSON',max_output_tokens:3000,prompt:codingPrompt});
   const review=await callCore(fetchImpl,coreApiUrl,key,'coding',{model:PIPELINE.codeReviewer,language:'JSON',max_output_tokens:3000,prompt:[
    'Review and improve the generated app files. Return ONLY valid JSON with the same schema {"files":[{"path":"...","content":"..."}]}.',
    'Keep the application requirements and existing file paths where possible. Fix missing imports, obvious type/build errors, incomplete UI and security issues. Return a complete replacement file set, max 20 files.',
    'Original user request:',prompt,
    'Implementation plan:',planReview.data?.message?.content||plan.data?.message?.content||'',
    'Generated files:',JSON.stringify(JSON.parse(result.data?.output?.trim()||'{}'))
   ].join('\n')});
   let files;try{files=parseFiles(review.data?.output);}catch(e){return send(res,502,{success:false,error:e.message,usage:result.usage});}
   for(const file of files){const saved=await store.putFile(user.id,m[1],file);if(!saved)return send(res,404,{success:false,error:'Project not found while saving files.'});}
   return send(res,200,{success:true,project:await store.getProject(user.id,m[1]),generatedFiles:files,modelsUsed:Object.values(PIPELINE),usage:{charged_usd:[plan.usage,planReview.usage,result.usage,review.usage].reduce((sum,item)=>sum+Number(item?.charged_usd||0),0),currency:'USD',calls:{planner:plan.usage,plannerReview:planReview.usage,coder:result.usage,codeReviewer:review.usage}}});
  }catch(e){return send(res,e.statusCode||502,{success:false,error:e.statusCode?e.message:'Generation failed unexpectedly.'});}
 };
}
