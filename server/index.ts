// QA Avatar Command: local server. Serves the UI and the same API routes the hosted version used,
// plus a direct connection to your local Autonomous QA Execution Agent. Listens on 127.0.0.1 only.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {extname,join,resolve,sep} from 'node:path';
import {Readable} from 'node:stream';
import * as workspaceRoute from '../app/api/workspace/route';
import * as documentsRoute from '../app/api/documents/route';
import * as documentByIdRoute from '../app/api/documents/[id]/route';
import * as analyzeRoute from '../app/api/documents/analyze/route';
import * as agent from './agent';
import {db} from '../lib/db';
import {dataDir} from '../local/sqlite';

const PORT=Number(process.env.PORT||4177);
const HOST='127.0.0.1';
const publicDir=resolve('dist/public');
const allowedHosts=new Set([HOST+':'+PORT,'localhost:'+PORT]);
const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.map':'application/json','.woff2':'font/woff2','.ico':'image/x-icon'};
const SECURITY={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
const CSP="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

const json=(code:number,body:unknown)=>Response.json(body,{status:code,headers:{'Cache-Control':'no-store'}});
function agentFailure(e:unknown){if(e instanceof agent.AgentError)return json(502,{error:e.message});console.error(e);return json(500,{error:'Unexpected error while contacting the local agent.'});}
// Runs ONLY a request that was saved in this app's workspace and that the person approved in the UI.
async function agentRun(request:Request){
 let body:any;try{body=await request.json();}catch{return json(400,{error:'Send JSON {job, approved:true}.'});}
 if(body?.approved!==true)return json(400,{error:'Approve the listed target systems before running.'});
 const runId=body?.job?.runId,projectId=body?.job?.projectId;
 const row=await db().prepare('SELECT data FROM qa_workspaces WHERE owner=?').bind('local-user').first<{data:string}>();
 const project=row?(JSON.parse(row.data).projects as any[]).find(p=>p.id===projectId):undefined;
 const saved=project?.execution?.lastJob;
 if(!saved||saved.runId!==runId||project.execution.importedAt)return json(409,{error:'This run request is not the pending request saved in the workspace. Prepare a new one.'});
 try{return json(200,await agent.runJob(saved));}catch(e){return agentFailure(e);}
}

async function api(request:Request,path:string,host:string):Promise<Response|null>{
 const m=request.method;
 if(path==='/api/workspace'){if(m==='GET')return workspaceRoute.GET();if(m==='PUT')return workspaceRoute.PUT(request);}
 if(path==='/api/documents'){if(m==='GET')return documentsRoute.GET(request);if(m==='POST')return documentsRoute.POST(request);}
 if(path==='/api/documents/analyze'&&m==='POST')return analyzeRoute.POST(request);
 const doc=path.match(/^\/api\/documents\/([\w-]+)$/);if(doc&&m==='GET')return documentByIdRoute.GET(request,{params:Promise.resolve({id:doc[1]})});
 if(path==='/api/agent/status'&&m==='GET')return json(200,{...await agent.status(),busy:agent.isRunning()});
 if(path==='/api/agent/catalog'&&m==='GET'){try{return json(200,await agent.catalog());}catch(e){return agentFailure(e);}}
 if(path==='/api/agent/run'&&m==='POST')return agentRun(request);
 return null;
}

async function serveFile(root:string,rel:string,res:http.ServerResponse,fallbackIndex:boolean){
 let full=resolve(join(root,decodeURIComponent(rel)));
 if(full!==root&&!full.startsWith(root+sep)){res.writeHead(403);return res.end('Forbidden');}
 try{if((await stat(full)).isDirectory())full=join(full,'index.html');await stat(full);}
 catch{if(!fallbackIndex){res.writeHead(404);return res.end('Not found');}full=join(root,'index.html');}
 const ext=extname(full);const body=await readFile(full);
 res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':ext==='.html'?'no-store':'no-cache',...SECURITY,...(ext==='.html'?{'Content-Security-Policy':CSP}:{})});
 res.end(body);
}

http.createServer(async(req,res)=>{
 try{
  const host=req.headers.host||'';
  // Blocks DNS-rebinding: only requests addressed to this exact local address are served.
  if(!allowedHosts.has(host)){res.writeHead(403);return res.end('Forbidden host');}
  const url=new URL(req.url||'/','http://'+host);const method=req.method||'GET';
  if(method!=='GET'&&method!=='HEAD'){
   // Blocks cross-site requests: a state-changing call must come from this app's own page.
   const origin=req.headers.origin;if(origin!=='http://'+host&&!(origin===undefined&&url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/api/agent/'))){res.writeHead(403,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Cross-origin request denied'}));}
  }
  if(url.pathname.startsWith('/api/')){
   const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(typeof v==='string')headers.set(k,v);
   const request=new Request(url,{method,headers,body:method==='GET'||method==='HEAD'?undefined:Readable.toWeb(req) as unknown as BodyInit,duplex:'half'} as RequestInit);
   const response=await api(request,url.pathname,host);
   if(!response){res.writeHead(404,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Not found'}));}
   const out:Record<string,string>={...SECURITY};response.headers.forEach((v,k)=>{out[k]=v;});
   res.writeHead(response.status,out);
   if(!response.body)return res.end();
   return Readable.fromWeb(response.body as never).pipe(res);
  }
  return serveFile(publicDir,url.pathname.replace(/^\/+/,''),res,true);
 }catch(e){console.error(e);if(!res.headersSent)res.writeHead(500);res.end('Server error');}
}).listen(PORT,HOST,()=>{
 console.log('\nQA Avatar Command is running.\n\n  Open: http://'+HOST+':'+PORT+'\n\nData is stored in: '+dataDir+'\nAI Review: '+(process.env.OPENAI_API_KEY?'enabled (OPENAI_API_KEY found)':'off (no OPENAI_API_KEY set; Analyze & draft still works)')+'\nPress Ctrl+C to stop.\n');
});
