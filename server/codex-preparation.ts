import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

class ReplacedBrowserSessionError extends Error {}

export async function inspectPreparationPage(browserPath:string,environment:string,storageState?:string):Promise<string> {
 const client=new Client({name:'qa-avatar-preparation',version:'1.0.0'});
 const environmentVariables={...process.env};
 for(const key of Object.keys(environmentVariables))if(key.startsWith('QA_')||['OPENAI_API_KEY','CODEX_API_KEY'].includes(key))delete environmentVariables[key];
 const transport=new StdioClientTransport({command:process.execPath,args:[browserPath],env:{
  ...environmentVariables,
  QA_CODEX_TARGET_ORIGIN:new URL(environment).origin,
  ...(storageState?{QA_CODEX_STORAGE_STATE:storageState}:{})
 },stderr:'pipe'});
 let timer:ReturnType<typeof setTimeout>|undefined;
 try {
  return await Promise.race([
   (async()=>{
    await client.connect(transport);
    const listed=await client.listTools();
    if(!listed.tools.some(tool=>tool.name==='inspect_page'))throw new Error('Browser inspection did not expose the required tool.');
    const result=await client.callTool({name:'inspect_page',arguments:{url:environment}});
    if(result.isError){const details=result.content as {type:string;text?:string}[];throw new Error(details.filter(item=>item.type==='text').map(item=>item.text||'').join('\n')||'The browser could not inspect the test environment.');}
    const content=result.content as {type:string;text?:string}[];
    const text=content.filter(item=>item.type==='text').map(item=>item.text||'').join('\n');
    if(!text.trim())throw new Error('Browser inspection returned no page content.');
    const inspected=JSON.parse(text);
    if(storageState&&new URL(inspected.url).pathname.replace(/\/$/,'')==='/login/duplicateUser')throw new ReplacedBrowserSessionError('HRMS replaced the saved sign-in because the same account signed in elsewhere. Save a fresh Playwright session and keep that account in one browser during preparation and execution.');
    return text;
   })(),
   new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Browser inspection timed out.')),75000);})
  ]);
 }catch(error) {
  if(error instanceof ReplacedBrowserSessionError)throw error;
  console.error('Browser inspection failed:',(error as Error).message);
  if(/timed.?out|timeout/i.test((error as Error).message))throw new Error('The test environment could not be reached or did not finish loading in time. Check that it opens from this computer, then prepare this batch again.');
  throw new Error('Browser inspection could not start or read the test environment. Run npm run codex:setup, check the environment URL and any saved browser sign-in, then prepare this batch again.');
 }finally {
  clearTimeout(timer);await client.close().catch(()=>{});
  await transport.close().catch(()=>{});
 }
}
