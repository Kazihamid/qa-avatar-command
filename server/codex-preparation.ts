import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

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
    if(result.isError)throw new Error('The browser could not inspect the test environment.');
    const content=result.content as {type:string;text?:string}[];
    const text=content.filter(item=>item.type==='text').map(item=>item.text||'').join('\n');
    if(!text.trim())throw new Error('Browser inspection returned no page content.');
    return text;
   })(),
   new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Browser inspection timed out.')),45000);})
  ]);
 }catch {
  throw new Error('Browser inspection could not start or read the test environment. Run npm run codex:setup, check the environment URL and any saved browser sign-in, then prepare this batch again.');
 }finally {
  clearTimeout(timer);await client.close().catch(()=>{});
  await transport.close().catch(()=>{});
 }
}
