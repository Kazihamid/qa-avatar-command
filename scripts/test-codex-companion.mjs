import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {makeCodexBatch,approvalSignature,validateCodexBatch} from '../dist/codex/model.mjs';

const temporary=await mkdtemp(join(tmpdir(),'qa-codex-worker-'));
let workspace,revision=1,runs=0,writes=0;
const scenarioId='11111111-1111-4111-8111-111111111111';
const workspaceId='22222222-2222-4222-8222-222222222222';
const applicationId='33333333-3333-4333-8333-333333333333';
let origin='';
const server=http.createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');
 const reply=(value,status=200)=>{res.writeHead(status);res.end(JSON.stringify(value));};
 if(req.url==='/api/workspace'){
  if(req.method==='GET')return reply({state:workspace,revision});
  let body='';for await(const chunk of req)body+=chunk;
  const input=JSON.parse(body);
  if(input.revision!==revision)return reply({error:'Conflict'},409);
  validateCodexBatch(input.state.projects[0].codex);
  workspace=input.state;revision++;return reply({revision});
 }
 if(req.url.endsWith('/scenarios/'+scenarioId))return reply({versionNo:1,automationIr:{steps:[{action:'navigate',url:origin}]}});
 if(req.url.endsWith('/scenario-actions/run')){
  runs++;return reply({results:[{scenarioId,status:'PASSED',exitCode:0,durationMs:20,stdout:'1 passed',stderr:''}]});
 }
 if(req.url==='/write'){writes++;return reply({ok:true});}
 res.setHeader('Content-Type','text/html');
 res.end('<h1>Companion fixture</h1><label>Name<input id="name"></label><script>fetch("/write",{method:"POST"})</script>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
origin='http://127.0.0.1:'+server.address().port;
const c={id:'CASE-1',title:'Use the saved fixture scenario',steps:'Run the recorded scenario.',expected:'Fixture succeeds.',status:'Not run',priority:'Medium',source:'Requirement 1',actual:'',evidence:''};
const project={id:'p1',name:'Companion integration fixture',environment:origin,build:'test',avatarId:'a1',requirements:'',cases:[c],bugs:[],execution:{workspaceId,applicationId,mappings:[{caseId:c.id,scenarioId,name:'Local fixture',version:1,targetUrl:origin}]}};
project.codex=makeCodexBatch(project,[c.id]);
workspace={avatars:[{id:'a1',name:'QA',role:'QA',color:'#123456'}],projects:[project]};
const client=new Client({name:'qa-avatar-test',version:'1.0.0'});
const transport=new StdioClientTransport({command:process.execPath,args:['dist/codex/browser.mjs'],env:{...process.env,QA_CODEX_TARGET_ORIGIN:origin},stderr:'pipe'});
const children=[];
let logs='';
const waitFor=async(predicate,label)=>{
 const until=Date.now()+30000;
 while(Date.now()<until){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,100));}
 throw new Error('Timeout waiting for '+label+'\n'+logs);
};
try {
 await client.connect(transport);
 const tools=await client.listTools();assert.deepEqual(tools.tools.map(t=>t.name),['inspect_page']);
 const snapshot=await client.callTool({name:'inspect_page',arguments:{url:origin}});
 assert.equal(snapshot.isError,undefined);
 assert.ok(snapshot.content[0].text.includes('Companion fixture'));
 assert.equal(writes,0,'Inspection must block page-initiated POST requests');
 const outside=await client.callTool({name:'inspect_page',arguments:{url:'https://example.invalid'}});
 assert.equal(outside.isError,true);
 await client.close();
 for(let i=0;i<2;i++) {
  const child=spawn(process.execPath,['dist/codex/worker.mjs'],{env:{...process.env,QA_AVATAR_URL:origin,QA_AGENT_CONTROL_PLANE_URL:origin,QA_AVATAR_PASSWORD:'',QA_DATA_DIR:temporary},windowsHide:true,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',chunk=>{logs+=chunk;});child.stderr.on('data',chunk=>{logs+=chunk;});children.push(child);
 }
 await waitFor(()=>workspace.projects[0].codex.status==='review','review plan');
 assert.equal(runs,0,'Preparing a plan must not run a scenario');
 const plan=workspace.projects[0].codex;
 assert.equal(plan.plan[0].mode,'agent');
 workspace=structuredClone(workspace);
 workspace.projects[0].codex.status='approved';
 workspace.projects[0].codex.approval=approvalSignature(workspace.projects[0].codex);revision++;
 await waitFor(()=>workspace.projects[0].codex.status==='completed','completed results');
 assert.equal(runs,1,'Concurrent companions must execute one claimed batch once');
 assert.equal(workspace.projects[0].cases[0].status,'Pass');
 assert.ok(workspace.projects[0].codex.report.includes('Pass — 1'));
 const runId=workspace.projects[0].codex.runId;
 const report=await readFile(join(temporary,'codex-runs',runId,'report.md'),'utf8');
 assert.ok(report.includes('Expected result'));
 // Restoring the same approved job must hit the local journal instead of replaying test actions.
 workspace=structuredClone(workspace);workspace.projects[0].codex.status='approved';revision++;
 await waitFor(()=>workspace.projects[0].codex.status==='error','replay protection');
 assert.equal(runs,1);
 console.log('Companion integration passed: real MCP inspection, blocked inspection writes, origin checks, mapped scenario reuse, approval gate, atomic claim across two workers, automatic import/report and replay prevention.');
}finally {
 await client.close().catch(()=>{});
 await Promise.all(children.map(child=>new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);child.kill();})));
 await new Promise(resolve=>server.close(resolve));
 const full=resolve(temporary);assert.ok(full.startsWith(resolve(tmpdir())+sep));await rm(full,{recursive:true,force:true});
}
