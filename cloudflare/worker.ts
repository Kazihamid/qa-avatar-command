import {env} from 'cloudflare:workers';
import {authorized,credentialsMatch,createSession,loginPage} from './auth';
import * as workspace from '../app/api/workspace/route';
import * as documents from '../app/api/documents/route';
import * as document from '../app/api/documents/[id]/route';
import * as analysis from '../app/api/documents/analyze/route';
type Bindings={APP_PASSWORD?:string;APP_USER?:string;ASSETS:{fetch(request:Request):Promise<Response>}};
const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
const csp="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
async function route(request:Request,bindings:Bindings):Promise<Response>{
 if(!bindings.APP_PASSWORD)return new Response('Private workspace access has not been configured.',{status:503});
 const url=new URL(request.url),method=request.method,path=url.pathname;
 if(!['GET','HEAD'].includes(method)&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return Response.json({error:'Cross-origin write denied.'},{status:403});
 if(path==='/auth/login'&&method==='POST'){
  if(Number(request.headers.get('content-length'))>4096)return new Response('Login request too large.',{status:413});
  const body=await request.text();if(body.length>4096)return new Response('Login request too large.',{status:413});
  const form=new URLSearchParams(body),username=form.get('username')||'',password=form.get('password')||'';
  if(!await credentialsMatch(username+':'+password,(bindings.APP_USER||'qa-admin')+':'+bindings.APP_PASSWORD))return loginPage(true);
  const session=await createSession(bindings.APP_PASSWORD,bindings.APP_USER);
  return new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':'qa_session='+session+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200'}});
 }
 if(path==='/auth/logout'&&method==='POST')return new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':'qa_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'}});
 if(!await authorized(request,bindings.APP_PASSWORD,bindings.APP_USER))return path.startsWith('/api/')?Response.json({error:'Sign in to your workspace.'},{status:401}):loginPage();
 if(path==='/auth/login')return new Response(null,{status:303,headers:{Location:'/'}});
 if(path==='/api/workspace'){if(method==='GET')return workspace.GET();if(method==='PUT')return workspace.PUT(request);}
 if(path==='/api/documents'){if(method==='GET')return documents.GET(request);if(method==='POST')return documents.POST(request);}
 if(path==='/api/documents/analyze'&&method==='POST')return analysis.POST(request);
 const match=path.match(/^\/api\/documents\/([\w-]+)$/);if(match&&method==='GET')return document.GET(request,{params:Promise.resolve({id:match[1]})});
 if(path==='/api/agent/status'&&method==='GET')return Response.json({reachable:false,busy:false,hosted:true,message:'This cloud workspace cannot connect to an agent on your computer. Use manual execution or the file handoff workflow.'});
 if(path.startsWith('/api/agent/'))return Response.json({error:'Direct access to a local agent is available only in the local app. Use file handoff or manual execution.'},{status:409});
 if(path.startsWith('/api/'))return Response.json({error:'Not found.'},{status:404});
 if(!['GET','HEAD'].includes(method))return new Response('Method not allowed.',{status:405});
 return bindings.ASSETS.fetch(request);
}
export default {async fetch(request:Request):Promise<Response>{
 let response:Response;try{response=await route(request,env as unknown as Bindings);}catch(error){console.error(error);response=Response.json({error:'The request could not be completed. Please try again.'},{status:500});}
 const result=new Response(response.body,response);for(const [key,value]of Object.entries(security))result.headers.set(key,value);
 result.headers.set('Cache-Control','no-store');if(result.headers.get('content-type')?.includes('text/html'))result.headers.set('Content-Security-Policy',csp);
 return result;
}};
