import { randomUUID } from 'node:crypto';
import { validateBuild } from './build-worker-client.js';
const COOKIE = 'builder_session';
const GENERATION_CREDIT_COST = 10;
const progressByProject = new Map();
function setProgress(userId, projectId, message, state = 'running') {
 const key = userId + ':' + projectId;
 const previous = progressByProject.get(key);
 const steps = previous?.steps ? [...previous.steps] : [];
 if (message && steps[steps.length - 1]?.message !== message) steps.push({ message, at: new Date().toISOString() });
 progressByProject.set(key, { state, steps: steps.slice(-20), updatedAt: new Date().toISOString() });
}
// Developer-controlled orchestration: end users never select models.
const PIPELINE = Object.freeze({
 planner: '4n-chat-naya-6',
 plannerReview: '4n-chat-naya-5.6',
 coder: '4n-code-nael-6.1',
 codeReviewer: '4n-code-nael-5.6'
});
function cookieValue(header=''){for(const item of header.split(';')){const [key,...rest]=item.trim().split('=');if(key===COOKIE)return rest.join('=');}return null;}
function send(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload));}
function safeDiagnosticMessage(error) {
 const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
 return message
  .replace(/Bearer\\s+[^\\s"'\x60]+/gi, 'Bearer [REDACTED]')
  .replace(/4ndev_sk_[A-Za-z0-9_-]+/g, '[REDACTED_CORE_KEY]')
  .replace(/\\bsk-[A-Za-z0-9_-]{12,}\\b/g, '[REDACTED_KEY]')
  .replace(/(authorization\\s*[:=]\\s*)[^\\s,;]+/gi, '$1[REDACTED]')
  .slice(0, 1000);
}
function logGenerationError({ stage, error, jobId, projectId }) {
 try {
  console.error('[builder-generation-error] ' + JSON.stringify({
   event: 'builder_generation_failed',
   stage,
   jobId: jobId || null,
   projectId,
   errorName: typeof error?.name === 'string' ? error.name : 'Error',
   errorMessage: safeDiagnosticMessage(error),
   statusCode: Number.isInteger(error?.statusCode) ? error.statusCode : null,
   code: typeof error?.code === 'string' ? error.code.slice(0, 80) : null,
   at: new Date().toISOString()
  }));
 } catch {}
}
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
export function createGenerationApi({store,fetchImpl=globalThis.fetch,coreApiUrl='https://api.4ndev.dev',coreApiKey=process.env.BUILDER_CORE_API_KEY,buildValidator=validateBuild}){
 return async function generationApi(req,res,url){
  const statusMatch=url.pathname.match(/^\/api\/projects\/([0-9a-f-]{36})\/generation-status$/i);
  if(statusMatch&&req.method==='GET'){
   const statusUser=await store.getUserForSession(cookieValue(req.headers.cookie));
   if(!statusUser)return send(res,401,{success:false,error:'Authentication required.'});
   const statusProject=await store.getProject(statusUser.id,statusMatch[1]);
   if(!statusProject)return send(res,404,{success:false,error:'Project not found.'});
   return send(res,200,{success:true,progress:progressByProject.get(statusUser.id+':'+statusMatch[1])||{state:'idle',steps:[],updatedAt:null}});
  }
  const m=url.pathname.match(/^\/api\/projects\/([0-9a-f-]{36})\/generate$/i);if(!m||req.method!=='POST')return false;
  const user=await store.getUserForSession(cookieValue(req.headers.cookie));if(!user)return send(res,401,{success:false,error:'Authentication required.'});
  let creditJobId=null;let creditsCharged=false;let generationCommitted=false;let stage='request-validation';
  async function refundFailedGeneration(){
   if(!creditsCharged||generationCommitted)return true;
   // Retry once with the same idempotency key; never report a refund as complete
   // when persistence did not confirm it.
   for(let attempt=0;attempt<2;attempt++){
    try{
     await store.grantCredits({userId:user.id,amount:GENERATION_CREDIT_COST,idempotencyKey:'generation:'+creditJobId+':refund',reason:'Refund for unsuccessful AI app generation',projectId:m[1],jobId:creditJobId});
     creditsCharged=false;
     return true;
    }catch{}
   }
   return false;
  }
  function refundPendingResponse(){
   return send(res,500,{success:false,error:'Generation failed and the credit refund could not be confirmed. Contact support with this reference.',refundPending:true,jobId:creditJobId});
  }
  try{
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16000)return send(res,413,{success:false,error:'Generation request is too large.'});chunks.push(chunk);}
   let body;try{body=chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{};}catch{return send(res,400,{success:false,error:'Request body must be valid JSON.'});}
   const prompt=typeof body.prompt==='string'?body.prompt.trim():'';
   if(!prompt||prompt.length>12000)return send(res,400,{success:false,error:'Describe the app in 1–12,000 characters.'});
   stage='project-lookup';const project=await store.getProject(user.id,m[1]);if(!project)return send(res,404,{success:false,error:'Project not found.'});
   if(typeof store.getBillingState!=='function')return send(res,503,{success:false,error:'Subscription status is unavailable.'});
   const billing=await store.getBillingState(user.id);
   const subscription=billing?.subscription;
   if(!subscription||subscription.plan==='free'||subscription.status!=='active'||Date.parse(subscription.periodEnd)<=Date.now()){
    return send(res,403,{success:false,error:'An active paid subscription is required for premium generation.'});
   }
   stage='core-key-lookup';const key=coreApiKey||await store.getCoreKey(user.id);if(!key)return send(res,503,{success:false,error:'Builder Core service key is not configured.'});
   setProgress(user.id,m[1],'Voaray ny prompt; manamarina kaonty sy manomana ny génération.');
   if(typeof store.consumeCredits!=='function'||typeof store.grantCredits!=='function')return send(res,503,{success:false,error:'Builder credit accounting is not configured.'});
   stage='credit-charge';creditJobId=randomUUID();
   try{
    await store.consumeCredits({userId:user.id,amount:GENERATION_CREDIT_COST,idempotencyKey:'generation:'+creditJobId+':charge',reason:'AI app generation',projectId:m[1],jobId:creditJobId});
    creditsCharged=true;
   }catch(error){
    if(error.code==='INSUFFICIENT_CREDITS')return send(res,402,{success:false,error:'Insufficient Builder credits. Choose a paid plan or add credits before generating.'});
    throw error;
   }
   stage='core-planner';setProgress(user.id,m[1],'Mandrafitra ny application.');
   const plan=await callCore(fetchImpl,coreApiUrl,key,'chat',{model:PIPELINE.planner,max_output_tokens:700,messages:[
    {role:'system',content:'You are the lead architect of a production web app builder. Convert the user request into a concise implementation plan. Identify pages, features, data entities, validation, security and responsive behavior. No source code.'},
    {role:'user',content:prompt}
   ]});
   stage='core-plan-review';setProgress(user.id,m[1],'Manatsara ny drafitry ny application.');
   const planReview=await callCore(fetchImpl,coreApiUrl,key,'chat',{model:PIPELINE.plannerReview,max_output_tokens:500,messages:[
    {role:'system',content:'Review the app plan for missing requirements, unsafe assumptions and implementation gaps. Return an improved concise plan only.'},
    {role:'user',content:'User request:\n'+prompt+'\n\nDraft plan:\n'+(plan.data?.message?.content||'')}
   ]});
   const codingPrompt=[
    'Generate a runnable multi-file React + TypeScript + Vite web app.',
    ...(/target platform:\s*mobile|mobile app|application mobile|react native|expo|android app|ios app/i.test(prompt) ? [ 'The user requested a mobile app. In addition to the buildable root web app, generate an Expo React Native source project under mobile/ with mobile/package.json, mobile/app.json, and mobile/App.tsx. Keep the root package.json Vite buildable; do not add Expo or React Native dependencies to the root package. Use a clear, app-specific mobile screen. The mobile source is not part of the Vite build.' ] : []),
    'Return ONLY valid JSON: {"files":[{"path":"package.json","content":"..."}]}. Content values must be JSON strings.',
    'Include package.json, index.html, src/main.tsx, src/App.tsx and src/index.css as appropriate.',
    'Responsive polished UI; complete imports and build scripts. No prose, secrets, node_modules or lockfiles. Max 20 files.',
    'Use only these preinstalled dependencies, with exact versions and no ranges, tags, URLs or wildcards: react 19.3.0, react-dom 19.3.0, vite 8.3.5, typescript 5.7.3, lucide-react 0.468.0, @vitejs/plugin-react 6.1.1, @types/react 19.3.0, @types/react-dom 19.3.0, @types/node 22.20.2.',
    'Do not add any other dependencies. Use browser APIs and CSS instead of uninstalled packages. Keep package.json dependencies and devDependencies pinned to the exact versions listed above.',
    'Project name: '+project.name,
    'Original user request:',prompt,
    'Implementation plan:',planReview.data?.message?.content||plan.data?.message?.content||''
   ].join('\n');
   stage='core-coding';setProgress(user.id,m[1],'Manoratra ny rakitra application.');
   const result=await callCore(fetchImpl,coreApiUrl,key,'coding',{model:PIPELINE.coder,language:'JSON',max_output_tokens:3000,prompt:codingPrompt});
   stage='core-code-review';setProgress(user.id,m[1],'Manamarina sy manatsara ny kaody.');
   const review=await callCore(fetchImpl,coreApiUrl,key,'coding',{model:PIPELINE.codeReviewer,language:'JSON',max_output_tokens:3000,prompt:[
    'Review and improve the generated app files. Return ONLY valid JSON with the same schema {"files":[{"path":"...","content":"..."}]}.',
    'Keep the application requirements and existing file paths where possible. Fix missing imports, obvious type/build errors, incomplete UI and security issues. Return a complete replacement file set, max 20 files.',
    'Original user request:',prompt,
    'Implementation plan:',planReview.data?.message?.content||plan.data?.message?.content||'',
    'Generated files:',JSON.stringify(JSON.parse(result.data?.output?.trim()||'{}'))
   ].join('\n')});
   setProgress(user.id,m[1],'Manamarina ny rakitra sy ny fiarovana azy.');
   stage='parse-generated-files';let files;try{files=parseFiles(review.data?.output);}catch(e){logGenerationError({stage,error:e,jobId:creditJobId,projectId:m[1]});setProgress(user.id,m[1],'TSY TAFITA: '+safeDiagnosticMessage(e),'failed');if(!await refundFailedGeneration())return refundPendingResponse();return send(res,502,{success:false,error:safeDiagnosticMessage(e),jobId:creditJobId,usage:result.usage});}
   setProgress(user.id,m[1],'Manangana sy mitsapa ny application.');
   stage='isolated-build-validation';let buildResult;try{buildResult=await buildValidator(files);}catch(e){logGenerationError({stage,error:e,jobId:creditJobId,projectId:m[1]});setProgress(user.id,m[1],'TSY TAFITA: tsy nahomby ny build: '+safeDiagnosticMessage(e),'failed');if(!await refundFailedGeneration())return refundPendingResponse();return send(res,e.statusCode||422,{success:false,error:'Generated app failed isolated build validation: '+safeDiagnosticMessage(e),jobId:creditJobId,usage:result.usage});}
   stage='save-generated-files';setProgress(user.id,m[1],'Nahomby ny fanamarinana; mitahiry ny application.');
   const filesToSave=buildResult?.previewHtml?[...files,{path:'__4ndev_preview.html',content:buildResult.previewHtml}]:files;
   const savedFiles=await store.putFiles(user.id,m[1],filesToSave);if(!savedFiles){setProgress(user.id,m[1],'TSY TAFITA: tsy voatahiry ny rakitra.','failed');if(!await refundFailedGeneration())return refundPendingResponse();return send(res,404,{success:false,error:'Project not found while saving files.'});}
   generationCommitted=true;
   setProgress(user.id,m[1],'VITA: voatahiry sy voamarina ny application.','completed');
   return send(res,200,{success:true,project:await store.getProject(user.id,m[1]),generatedFiles:files,previewAvailable:Boolean(buildResult?.previewHtml),modelsUsed:Object.values(PIPELINE),creditsCharged:GENERATION_CREDIT_COST,usage:{charged_usd:[plan.usage,planReview.usage,result.usage,review.usage].reduce((sum,item)=>sum+Number(item?.charged_usd||0),0),currency:'USD',calls:{planner:plan.usage,plannerReview:planReview.usage,coder:result.usage,codeReviewer:review.usage}}});
  }catch(e){logGenerationError({stage,error:e,jobId:creditJobId,projectId:m[1]});const safeMessage=safeDiagnosticMessage(e);setProgress(user.id,m[1],'TSY TAFITA: '+(e.statusCode?safeMessage:'Generation failed unexpectedly.'),'failed');if(!await refundFailedGeneration())return refundPendingResponse();return send(res,e.statusCode||502,{success:false,error:e.statusCode?safeMessage:'Generation failed unexpectedly. Reference: '+(creditJobId||'not-assigned'),jobId:creditJobId||null});}
 };
}
