import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import net from 'node:net';
import {chromium} from 'playwright';
import {makeCodexBatch,approvalSignature,validateCodexBatch} from '../dist/codex/model.mjs';

const temporary=await mkdtemp(join(tmpdir(),'qa-codex-ui-'));
const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const origin='http://127.0.0.1:'+port;
const child=spawn(process.execPath,['dist/server/index.mjs'],{env:{...process.env,PORT:String(port),QA_DATA_DIR:temporary,OPENAI_API_KEY:''},windowsHide:true,stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',chunk=>{logs+=chunk});child.stderr.on('data',chunk=>{logs+=chunk});
let browser;
const call=async(body)=>{
 const response=await fetch(origin+'/api/workspace',{method:body?'PUT':'GET',headers:{Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;
};
try {
 const until=Date.now()+10000;
 while(!logs.includes('QA Avatar Command is running.')){if(Date.now()>until)throw new Error(logs);await new Promise(r=>setTimeout(r,50));}
 const workspace=await call();
 const avatar=workspace.state.avatars[0];
 const item={id:'CASE-1',title:'Save valid objective dates',preconditions:'Open an objective',testData:'Approved objective dates',steps:'Enter dates and save.',expected:'Saved',status:'Not run',priority:'Medium',source:'Requirements 1',actual:'',evidence:''};
 const project={id:'codex-ui',name:'Codex UI Regression',environment:'https://test.example',build:'test',avatarId:avatar?.id||'',requirements:'',cases:[item],bugs:[]};
 const batch=makeCodexBatch(project,[item.id]);
 batch.status='review';batch.plan=[{caseId:item.id,mode:'manual',reason:'Browser inspection is unavailable. Restore the inspection connection before preparing this test.',steps:[]}];
 project.codex=batch;
 await call({state:{...workspace.state,projects:[project]},revision:workspace.revision});
 assert.throws(()=>validateCodexBatch({...batch,status:'approved',approval:approvalSignature(batch)}),/executable case/);
 browser=await chromium.launch({headless:true});const page=await browser.newPage();
 await page.goto(origin);
 await page.getByRole('tab',{name:'Execution',exact:true}).click();
 await page.getByText('Preparation Needs Attention',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Approve & Run',exact:true}).count(),0);
 assert.ok(await page.getByText(batch.plan[0].reason,{exact:true}).isVisible());
 assert.ok(await page.getByText('0 ready to run · 1 need attention',{exact:true}).isVisible());
 await page.getByRole('button',{name:'Prepare This Batch Again',exact:true}).click();
 await page.getByText('Waiting For Companion',{exact:true}).waitFor();
 let updated=await call();
 assert.equal(updated.state.projects[0].codex.status,'queued');
 assert.notEqual(updated.state.projects[0].codex.runId,batch.runId);
 assert.deepEqual(updated.state.projects[0].codex.cases.map(c=>c.id),[item.id]);
 const ready=updated.state.projects[0].codex;ready.status='review';ready.plan=[{caseId:item.id,mode:'browser',reason:'Inspect the objective form.',steps:[{action:'visible',by:'text',locator:'Objective',name:'',value:''}]}];
 await call(updated);
 await page.reload();await page.getByRole('tab',{name:'Execution',exact:true}).click();
 const approve=page.getByRole('button',{name:'Approve & Run',exact:true});
 assert.equal(await approve.isDisabled(),true);
 await page.getByRole('checkbox',{name:/I reviewed these cases/}).check();
 assert.equal(await approve.isEnabled(),true);
 const dataField=page.getByLabel('Batch Test Data (Optional)');await dataField.fill('Changed inputs');assert.equal(await approve.isDisabled(),true);await dataField.fill('');assert.equal(await approve.isEnabled(),true);
 await approve.click();await page.getByText('Approved — Waiting For Companion',{exact:true}).waitFor();
 updated=await call();assert.equal(updated.state.projects[0].codex.status,'approved');
 console.log('Codex approval UI passed: all-manual reasons visible, no misleading run action, retry preserves cases, and executable batches enable only after review.');
}finally {
 await browser?.close();
 await new Promise(r=>{if(child.exitCode!==null)return r();child.once('exit',r);child.kill();});
 const full=resolve(temporary);assert.ok(full.startsWith(resolve(tmpdir())+sep));await rm(full,{recursive:true,force:true});
}
