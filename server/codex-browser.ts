import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {chromium} from 'playwright';
import {z} from 'zod';
const origin=process.env.QA_CODEX_TARGET_ORIGIN;
if(!origin)throw new Error('A test environment must be supplied by the companion.');
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({storageState:process.env.QA_CODEX_STORAGE_STATE||undefined,serviceWorkers:'block'});
await context.route('**/*',async route=>{
 const request=route.request();
 // Inspection has no form submission or browser action tools.
 if(!['GET','HEAD'].includes(request.method())||(request.isNavigationRequest()&&new URL(request.url()).origin!==origin))return route.abort();
 return route.continue();
});
const server=new McpServer({name:'qa-avatar-browser',version:'1.0.0'});
server.tool('inspect_page','Read the accessibility tree and form field selectors on a page within the approved QA environment. This tool performs GET navigation only.',{url:z.string().url()},{readOnlyHint:true,destructiveHint:false},async({url})=>{
 if(new URL(url).origin!==origin)throw new Error('Only the approved environment can be inspected.');
 const page=await context.newPage();
 try {
  await page.goto(url,{waitUntil:'commit',timeout:45000});
  await page.waitForFunction(()=>!!document.body?.innerText.trim(),{},{timeout:20000});
  await page.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});
  const snapshot=await page.locator('body').ariaSnapshot({timeout:10000});
  const forms=[];
  for(const form of (await page.locator('form').all()).slice(0,5))if(await form.isVisible())forms.push((await form.ariaSnapshot({timeout:5000})).slice(0,10000));
  const summary=snapshot.length>30000?snapshot.slice(0,8000)+'\n[Middle navigation omitted]\n'+snapshot.slice(-22000):snapshot;
  const fields=await page.locator('input,select,textarea').evaluateAll(elements=>elements.slice(0,60).map(e=>({tag:e.tagName,id:e.id,name:e.getAttribute('name'),type:e.getAttribute('type'),placeholder:e.getAttribute('placeholder')})));
  return {content:[{type:'text' as const,text:JSON.stringify({url:page.url(),snapshot:summary,forms,fields})}]};
 }finally {await page.close();}
});
const cleanup=async()=>{await browser.close();process.exit(0);};
process.stdin.on('end',cleanup);
process.on('SIGTERM',cleanup);process.on('SIGINT',cleanup);
await server.connect(new StdioServerTransport());
