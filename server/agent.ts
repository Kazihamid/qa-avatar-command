// Direct connection from this local app to the Autonomous QA Execution Agent control plane.
// Equivalent to the hosted version's qa_avatar_bridge.py, without the manual file handoff.
// Safety: loopback control-plane URLs only, no redirects, no stored tokens, runs only a request that was
// saved in this app's workspace, one run at a time, execution POSTs are never retried.
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {validateJob,type ExecutionJob} from '../lib/execution-model';
import {dataDir} from '../local/sqlite';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class AgentError extends Error{}
const uid=(v:unknown):string=>{if(typeof v!=='string'||!UUID.test(v))throw new AgentError('Invalid workspace, application, scenario or run ID.');return v;};
const targetUrl=(v:unknown):string=>{try{const u=new URL(String(v));if(!['http:','https:'].includes(u.protocol)||!u.hostname||u.username||u.password)throw 0;return String(v);}catch{throw new AgentError('Scenario target is not a supported HTTP URL.');}};

export function controlPlane():string{
 const raw=process.env.QA_AGENT_CONTROL_PLANE_URL||'http://localhost:8080';
 let u:URL;try{u=new URL(raw);}catch{throw new AgentError('QA_AGENT_CONTROL_PLANE_URL is not a valid URL.');}
 if(!['http:','https:'].includes(u.protocol)||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.username||u.password||u.search||u.hash||!['','/'].includes(u.pathname))
  throw new AgentError('The control-plane URL must be a loopback HTTP(S) origin, normally http://localhost:8080.');
 return u.origin;
}
function headers():Record<string,string>{
 const h:Record<string,string>={'Content-Type':'application/json',Accept:'application/json'};
 const token=process.env.QA_AGENT_BEARER_TOKEN;
 if(token)h.Authorization='Bearer '+token;
 else{h['X-Dev-User-Sub']=process.env.QA_AGENT_DEV_SUB||'dev-user-001';h['X-Dev-User-Email']=process.env.QA_AGENT_DEV_EMAIL||'qa.engineer@example.invalid';h['X-Dev-User-Name']=process.env.QA_AGENT_DEV_NAME||'QA Engineer';}
 return h;
}
async function api(path:string,body?:unknown,timeoutMs=300000):Promise<any>{
 let res:Response;
 try{res=await fetch(controlPlane()+path,{method:body===undefined?'GET':'POST',headers:headers(),body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(timeoutMs)});}
 catch(e){if(e instanceof AgentError)throw e;throw new AgentError('Cannot reach the local control plane at '+controlPlane()+'. Start the agent Docker project and check that address.');}
 if(!res.ok){await res.body?.cancel().catch(()=>{});throw new AgentError('Control plane returned HTTP '+res.status+'. Check the local identity, workspace access and the agent service logs.');}
 const text=await res.text();if(text.length>2_000_000)throw new AgentError('Control-plane response is too large.');
 try{return JSON.parse(text);}catch{throw new AgentError('Control plane returned an unreadable response.');}
}

export async function status(){
 try{const w=await api('/api/v1/workspaces',undefined,6000);return {controlPlane:controlPlane(),reachable:true,workspaces:Array.isArray(w)?w.length:0,message:'Connected.'};}
 catch(e){return {controlPlane:(()=>{try{return controlPlane();}catch{return null;}})(),reachable:false,message:(e as Error).message};}
}

async function snapshot(w:string,a:string,s:string){
 const prefix='/api/v1/workspaces/'+uid(w)+'/applications/'+uid(a);
 const detail=await api(prefix+'/scenarios/'+uid(s));
 const version=detail?.versionNo;if(!Number.isInteger(version)||version<1)throw new AgentError('Scenario has no saved version.');
 let target:string|undefined;const source=detail.sourceRecordingSessionId;
 if(source)target=(await api(prefix+'/recording-sessions/'+uid(source)))?.startUrl;
 if(!target)target=(detail.automationIr?.steps||[]).find((x:any)=>x.action==='navigate'&&x.url)?.url;
 if(!target)throw new AgentError('Scenario has no target URL.');
 return {version:version as number,target:targetUrl(target)};
}

export async function catalog(){
 const apps:any[]=[];const workspaces=await api('/api/v1/workspaces');
 if(!Array.isArray(workspaces))throw new AgentError('Unexpected workspace response.');
 for(const w of workspaces)for(const a of await api('/api/v1/workspaces/'+uid(w.id)+'/applications')){
  const scenarios:any[]=[];
  for(const s of await api('/api/v1/workspaces/'+uid(w.id)+'/applications/'+uid(a.id)+'/scenarios')){
   if(scenarios.length>=2000)throw new AgentError('An application has more than 2000 scenarios; reduce its scope.');
   const {version,target}=await snapshot(w.id,a.id,s.id);
   scenarios.push({scenarioId:s.id,name:String(s.name).slice(0,1000),version,targetUrl:target});
  }
  apps.push({workspaceId:w.id,applicationId:a.id,workspaceName:String(w.name).slice(0,1000),applicationName:String(a.name).slice(0,1000),scenarios});
  if(apps.length>200)throw new AgentError('Catalog exceeds 200 applications; reduce scope.');
 }
 return {format:'qa-avatar-catalog-v1',createdAt:new Date().toISOString(),applications:apps};
}

// Conservative mapping, identical to the bridge: Pass only when pytest reports >=1 passed and nothing skipped/errored.
export function mappedResult(result:any):{status:'Pass'|'Fail'|'Needs clarification'|'Blocked';actual:string}{
 const status=result?.status,exit=result?.exitCode,duration=result?.durationMs??0;
 if(!['PASSED','FAILED','TIMED_OUT','ERROR'].includes(status))throw new AgentError('Unknown runner status.');
 if(exit!==null&&exit!==undefined&&!Number.isInteger(exit))throw new AgentError('Invalid runner exit code.');
 if(!Number.isInteger(duration)||duration<0||duration>900000)throw new AgentError('Invalid runner duration.');
 const text=String(result.stdout??'').replace(/\x1b\[[0-9;]*m/g,'');
 const counts:Record<string,number>={};for(const name of ['passed','failed','skipped','xfailed','xpassed','errors'])counts[name]=[...text.matchAll(new RegExp('(?<!\\w)(\\d+) '+name+'\\b','g'))].reduce((n,m)=>n+Number(m[1]),0);
 let qa:'Pass'|'Fail'|'Needs clarification'|'Blocked';
 if(status==='PASSED'&&exit===0&&counts.passed>0&&!['failed','skipped','xfailed','xpassed','errors'].some(k=>counts[k]))qa='Pass';
 else if(status==='FAILED'&&exit===1&&counts.failed>0)qa='Fail';
 else if(status==='PASSED'&&exit===0)qa='Needs clarification';
 else qa='Blocked';
 return {status:qa,actual:'Local Playwright/Pytest scenario: '+status+'; exit code '+exit+'; duration '+duration+' ms. '+Object.keys(counts).map(k=>counts[k]+' '+k).join(', ')+'. Review the local logs and scenario assertions.'};
}

let running=false;
export const isRunning=()=>running;
export async function runJob(input:unknown){
 validateJob(input);const job=input as ExecutionJob;
 if(running)throw new AgentError('A run is already in progress.');
 running=true;
 try{
  // Preflight every scenario first; never silently use a newer recording or a different target.
  for(const c of job.cases){const snap=await snapshot(job.workspaceId,job.applicationId,c.scenarioId);if(snap.version!==c.version||snap.target!==c.targetUrl)throw new AgentError('A scenario version or target changed. Reload scenarios from the agent and create a new run request.');}
  const prefix='/api/v1/workspaces/'+job.workspaceId+'/applications/'+job.applicationId+'/scenario-actions/run';
  const dir=join(dataDir,'agent-evidence',job.runId);await mkdir(dir,{recursive:true});
  const results:any[]=[];let index=0;
  for(const c of job.cases){
   index++;console.log('Agent run '+job.runId.slice(0,8)+': '+index+'/'+job.cases.length+' '+c.caseId);
   let raw:any,status:string,actual:string;
   try{
    // Never retried: a timeout could mean the test already ran.
    const response=await api(prefix,{scenarioIds:[c.scenarioId]});const entries=response?.results;
    if(!Array.isArray(entries)||entries.length!==1||entries[0].scenarioId!==c.scenarioId)throw new AgentError('Runner returned a mismatched result.');
    raw=entries[0];({status,actual}=mappedResult(raw));
   }catch(e){raw={scenarioId:c.scenarioId,status:'ERROR',exitCode:null,durationMs:0,stdout:'',stderr:String((e as Error).message)};status='Blocked';actual='Local agent request failed or its outcome could not be confirmed. Inspect the local logs before retrying.';}
   const file=join(dir,'case-'+index+'.json');await writeFile(file+'.tmp',JSON.stringify(raw,null,2),'utf8');await rename(file+'.tmp',file);
   results.push({id:c.caseId,scenarioId:c.scenarioId,fingerprint:c.fingerprint,status,actual,evidence:'Local agent evidence: '+file.replace(/\\/g,'/')});
  }
  return {format:'qa-avatar-results-v1',runId:job.runId,projectId:job.projectId,workspaceId:job.workspaceId,applicationId:job.applicationId,finishedAt:new Date().toISOString(),results};
 }finally{running=false;}
}
