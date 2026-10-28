const encoder=new TextEncoder();
export async function credentialsMatch(actual:string,expected:string):Promise<boolean>{
 const hashes=await Promise.all([actual,expected].map(value=>crypto.subtle.digest('SHA-256',encoder.encode(value))));
 const a=new Uint8Array(hashes[0]),b=new Uint8Array(hashes[1]);let difference=0;
 for(let i=0;i<a.length;i++)difference|=a[i]^b[i];return difference===0;
}
const key=(password:string,username:string)=>crypto.subtle.importKey('raw',encoder.encode(username+'\0'+password),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
export async function createSession(password:string,username='qa-admin',now=Date.now()):Promise<string>{
 if(!password)throw new Error('Missing login secret');
 const payload=Math.floor(now/1000+43200)+'.'+crypto.randomUUID();
 return payload+'.'+hex(await crypto.subtle.sign('HMAC',await key(password,username),encoder.encode(payload)));
}
export async function authorized(request:Request,password:string,username='qa-admin',now=Date.now()):Promise<boolean>{
 if(!password)return false;
 const cookie=request.headers.get('cookie')?.split(';').map(item=>item.trim()).find(item=>item.startsWith('qa_session='))?.slice(11);
 if(cookie&&/^\d+\.[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(cookie)){
  const [expires,nonce,signature]=cookie.split('.');
  if(Number(expires)>now/1000&&Number(expires)<=now/1000+43201){
   const bytes=Uint8Array.from(signature.match(/../g)!,part=>parseInt(part,16));
   if(await crypto.subtle.verify('HMAC',await key(password,username),bytes,encoder.encode(expires+'.'+nonce)))return true;
  }
 }
 // Retain explicit Basic credentials for existing scripts; browsers receive no HTTP challenge.
 const header=request.headers.get('authorization')||'';
 if(!header.startsWith('Basic '))return false;
 let supplied:string;try{supplied=atob(header.slice(6));}catch{return false;}
 return credentialsMatch(supplied,username+':'+password);
}
export function loginPage(error=false):Response{
 return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign In · QA Avatar Command</title><style>body{margin:0;background:#f3f6fc;color:#10243f;font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh}.card{box-sizing:border-box;background:white;border:1px solid #dce5ef;border-radius:16px;padding:32px;width:min(440px,calc(100% - 32px));box-shadow:0 12px 35px #10243f0c}h1{font-size:25px;margin:0 0 8px}p{color:#63758f;margin:0 0 24px}label{display:block;font-weight:600;margin-top:18px}input{box-sizing:border-box;width:100%;font:inherit;padding:12px;border:1px solid #cbd7e8;border-radius:8px;margin-top:6px}input:focus{outline:2px solid #2454db;outline-offset:2px}button{width:100%;font:inherit;font-weight:600;background:#2454db;border:0;border-radius:8px;color:white;padding:12px;margin-top:24px;cursor:pointer}.error{background:#fff0f0;color:#991b1b;padding:12px;border-radius:8px;margin:16px 0}</style></head><body><main class="card"><h1>QA Avatar Command</h1><p>Sign in to your private QA workspace.</p>${error?'<div class="error" role="alert">Incorrect username or password. Please try again.</div>':''}<form method="post" action="/auth/login"><label for="username">Username</label><input id="username" name="username" autocomplete="username" maxlength="300" required autofocus><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="1000" required><button type="submit">Sign In</button></form></main></body></html>`,{status:error?400:200,headers:{'Content-Type':'text/html; charset=utf-8'}});
}

export function safeWriteOrigin(request:Request):boolean {
 if(['GET','HEAD'].includes(request.method))return true;
 const origin=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
 if(origin===new URL(request.url).origin)return true;
 // Older login pages used no-referrer, which sends a null Origin on navigation POSTs.
 if(origin==='null')return site==='same-origin';
 if(origin)return false;
 return site!=='cross-site'&&site!=='same-site';
}
