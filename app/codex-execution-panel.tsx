'use client';
import {useState,useEffect} from 'react';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';
import {makeCodexBatch,assertCurrentBatch,approvalSignature} from '@/lib/codex-execution';
import {cleanCaseText} from '@/lib/case-title';
import type {Project} from '@/lib/model';

export default function CodexExecutionPanel({project,onSave,busy}:{project:Project;onSave:(p:Project)=>Promise<boolean>;busy:boolean}) {
 const [entryUrl,setEntryUrl]=useState(project.codex?.entryUrl||'');
 const [selected,setSelected]=useState<string[]>([]),[reviewed,setReviewed]=useState(false);
 const [testData,setTestData]=useState(project.codex?.testData||'');
 const batch=project.codex;
 useEffect(()=>{setEntryUrl(batch?.entryUrl||'');setTestData(batch?.testData||'');setReviewed(false)},[batch?.runId]);
 const inputsChanged=!!batch&&(entryUrl.trim()!==(batch.entryUrl||'')||testData.trim()!==(batch.testData||''));
 const runnable=batch?.plan?.filter(entry=>entry.mode!=='manual').length||0;
 const needsAttention=batch?.status==='review'&&!!batch.plan&&!runnable;
 const active=!!batch&&['queued','preparing','approved','running'].includes(batch.status);
 let stale=false;
 if(batch)try{assertCurrentBatch(batch,project);}catch{stale=true;}
 async function prepare() {
  try {const next=makeCodexBatch(project,selected,entryUrl.trim(),testData.trim());if(await onSave({...project,codex:next}))setReviewed(false);}
  catch(error){toast.error((error as Error).message);}
 }
 async function retryBatch() {
  if(!batch)return;
  try{const next=makeCodexBatch(project,batch.cases.map(c=>c.id),entryUrl.trim(),testData.trim());if(await onSave({...project,codex:next}))setReviewed(false);}
  catch(error){toast.error((error as Error).message);}
 }
 async function approve() {
  if(!batch||!reviewed||!runnable||inputsChanged)return;
  try{assertCurrentBatch(batch,project);await onSave({...project,codex:{...batch,status:'approved',approval:approvalSignature(batch),message:'Waiting for your companion to run the approved batch.'}});}
  catch(error){toast.error((error as Error).message);}
 }
 function downloadReport() {
  if(!batch?.report)return;
  const url=URL.createObjectURL(new Blob([batch.report],{type:'text/markdown;charset=utf-8'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download='QA-Report-'+batch.runId+'.md';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <section className="content-panel codex-execution-panel">
  <div className="section-heading"><div><h3>Execute With Codex</h3><p>Select up to 10 reviewed cases. Codex prepares browser actions for your approval, then your computer runs them and sends the results here.</p></div></div>
  <p className="file-help">Start the Codex companion on your PC and keep it running for preparation and execution. It uses your Codex sign-in and usage allowance. <a href="https://github.com/Kazihamid/qa-avatar-command#codex-execution-companion" target="_blank" rel="noreferrer">Setup instructions</a></p>
  <label className="field"><span>Test Page URL (Optional)</span><input type="url" value={entryUrl} disabled={busy||active} placeholder={project.environment} onChange={event=>setEntryUrl(event.target.value)}/></label>
  <label className="field"><span>Batch Test Data (Optional)</span><textarea rows={5} value={testData} disabled={busy||active} onChange={event=>setTestData(event.target.value)}/></label><p className="file-help">Prepare a new batch to apply the page URL and test data.</p>
  <div className="execution-actions"><Button variant="outline" disabled={busy||active||!project.cases.length} onClick={()=>setSelected(project.cases.slice(0,10).map(c=>c.id))}>Select First 10</Button><Button variant="outline" disabled={busy||active||!selected.length} onClick={()=>setSelected([])}>Deselect All</Button><span>{selected.length} selected</span></div>
  <div className="codex-case-picker">{project.cases.map(c=><label key={c.id}><input type="checkbox" checked={selected.includes(c.id)} disabled={busy||active||(!selected.includes(c.id)&&selected.length>=10)} onChange={e=>setSelected(previous=>e.target.checked?[...previous,c.id]:previous.filter(id=>id!==c.id))}/><span>{cleanCaseText(c.title)}</span></label>)}</div>
  <Button disabled={busy||active||!selected.length} onClick={prepare}>Prepare With Codex</Button>
  {batch&&<div className="subtle-note" aria-live="polite">
   <p><strong>{needsAttention?'Preparation Needs Attention':({queued:'Waiting For Companion',preparing:'Preparing Execution Plan',review:'Ready For Review',approved:'Approved — Waiting For Companion',running:'Running Tests',completed:'Test Report Ready',error:'Batch Stopped',cancelled:'Batch Cancelled'})[batch.status]}</strong></p>
   <p>{needsAttention?'None of these '+batch.cases.length+' cases has an executable plan yet. Review the reasons below, resolve them, then prepare this batch again.':batch.message}</p>
   {batch.status==='review'&&<p>{runnable} ready to run · {(batch.plan?.length||0)-runnable} need attention</p>}
   <p className="file-help">Run {batch.runId} · {batch.cases.length} cases · {batch.environment}</p>
   {batch.entryUrl&&<p className="file-help">Test page {batch.entryUrl}</p>}
   {batch.testData&&<details><summary>Batch Test Data</summary><pre className="requirements-text">{batch.testData}</pre></details>}
   {inputsChanged&&<p>Prepare a new plan to use the edited inputs.</p>}
   {stale&&<p>The cases or target environment changed. Prepare a new batch before executing.</p>}
   {batch.plan&&<div>{batch.plan.map(entry=><details key={entry.caseId} open={entry.mode==='manual'?true:undefined}><summary>{cleanCaseText(batch.cases.find(c=>c.id===entry.caseId)!.title)} · {entry.mode==='manual'?'Needs Review':entry.mode==='agent'?'Saved Scenario':'Browser Test'}</summary><p>{entry.reason}</p>{entry.steps.length>0&&<ol>{entry.steps.map((step,i)=><li key={i}>{({navigate:'Open Page',click:'Click',fill:'Enter',select:'Select',check:'Check',uncheck:'Uncheck',visible:'Confirm Visible',hidden:'Confirm Hidden',text:'Check Text',value:'Check Value',url:'Check Page Address',count:'Check Item Count'})[step.action]} {step.by==='role'?step.locator+' '+step.name:step.locator}{step.value?' — '+step.value:''}</li>)}</ol>}</details>)}</div>}
   {batch.status==='review'&&!needsAttention&&<><label className="codex-approval"><input key={batch.runId} type="checkbox" checked={reviewed} disabled={busy||stale} onChange={e=>setReviewed(e.target.checked)}/> I reviewed these cases, browser actions, test data and target environment. I approve this batch, including actions that change test records.</label><Button disabled={busy||stale||!reviewed||!runnable||inputsChanged} onClick={approve}>Approve &amp; Run</Button></>}
   {(needsAttention||batch.status==='error')&&<div><p>Check your browser sign-in and the test setup or values described above. After correcting them, retry with the current versions of these cases.</p><Button disabled={busy||active} onClick={retryBatch}>Prepare This Batch Again</Button></div>}
   {['queued','preparing','review','approved','running'].includes(batch.status)&&<Button variant="outline" disabled={busy} onClick={()=>onSave({...project,codex:{...batch,status:'cancelled',message:'Cancellation requested. A browser action already in progress may finish. Review local evidence before retrying.'}})}>Cancel Batch</Button>}
   {batch.results&&<><p>{['Pass','Fail','Blocked','Needs clarification'].map(status=>status+' '+batch.results!.filter(r=>r.status===status).length).join(' · ')}</p><Button variant="outline" onClick={downloadReport}>Download Test Report</Button><details><summary>View Test Results</summary>{batch.results.map(result=><div key={result.id}><strong>{cleanCaseText(batch.cases.find(c=>c.id===result.id)!.title)} · {result.status}</strong><p>{result.actual}</p><p className="file-help">{result.evidence}</p></div>)}</details></>}
  </div>}
 </section>;
}
