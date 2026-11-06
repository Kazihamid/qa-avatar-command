import {fingerprint,type ScenarioLink} from './execution-model';
import type {Case,Project} from './model';

export type BrowserAction='navigate'|'click'|'fill'|'select'|'check'|'uncheck'|'visible'|'hidden'|'text'|'value'|'url'|'count';
export type BrowserStep={action:BrowserAction;by:'role'|'label'|'text'|'placeholder'|'testId'|'css';locator:string;name:string;value:string};
export type CodexPlan={caseId:string;mode:'browser'|'agent'|'manual';reason:string;steps:BrowserStep[]};
export type CodexResult={id:string;fingerprint:string;status:'Pass'|'Fail'|'Blocked'|'Needs clarification';actual:string;evidence:string;assertions:number};
export type CodexBatch={
 format:'qa-avatar-codex-v1';runId:string;projectId:string;projectName:string;environment:string;build:string;avatarId:string;createdAt:string;
 status:'queued'|'preparing'|'review'|'approved'|'running'|'completed'|'error'|'cancelled';
 cases:(Case&{fingerprint:string})[];agent?:{workspaceId:string;applicationId:string;mappings:ScenarioLink[]};
 plan?:CodexPlan[];approval?:string;workerId?:string;message?:string;results?:CodexResult[];report?:string;finishedAt?:string;
};
const statuses=['queued','preparing','review','approved','running','completed','error','cancelled'];
const actions=['navigate','click','fill','select','check','uncheck','visible','hidden','text','value','url','count'];
const assertionActions=new Set(['visible','hidden','text','value','url','count']);
const text=(v:unknown,max=20000):v is string=>typeof v==='string'&&v.length<=max;
export function executionOrigin(value:string):string {
 const url=new URL(value);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Enter an HTTP or HTTPS test environment without credentials in its URL.');
 return url.origin;
}
export function makeCodexBatch(project:Project,caseIds:string[]):CodexBatch {
 executionOrigin(project.environment);
 const cases=project.cases.filter(c=>caseIds.includes(c.id));
 if(!cases.length||cases.length!==new Set(caseIds).size||cases.length>10)throw new Error('Select between 1 and 10 test cases for this batch.');
 if(cases.some(c=>!c.steps.trim()||!c.expected.trim()))throw new Error('Add steps and expected results to the selected cases first.');
 return {format:'qa-avatar-codex-v1',runId:crypto.randomUUID(),projectId:project.id,projectName:project.name,environment:project.environment,build:project.build,avatarId:project.avatarId,createdAt:new Date().toISOString(),status:'queued',cases:cases.map(c=>({...c,fingerprint:fingerprint(c)})),
 ...(project.execution?{agent:{workspaceId:project.execution.workspaceId,applicationId:project.execution.applicationId,mappings:project.execution.mappings.filter(m=>caseIds.includes(m.caseId))}}:{})};
}
export function assertCurrentBatch(batch:CodexBatch,project:Project) {
 if(batch.projectId!==project.id||batch.environment!==project.environment||batch.build!==project.build||batch.avatarId!==project.avatarId||batch.cases.some(c=>{const current=project.cases.find(item=>item.id===c.id);return !current||fingerprint(current)!==c.fingerprint;}))throw new Error('The cases, assignment, build or environment changed. Prepare a new batch.');
}
export function validateCodexPlan(plan:unknown,batch:CodexBatch):asserts plan is CodexPlan[] {
 if(!Array.isArray(plan)||plan.length!==batch.cases.length||JSON.stringify(plan).length>150000)throw new Error('The plan must account for every requested case.');
 const seen=new Set();
 for(const entry of plan) {
  if(!entry||!batch.cases.some(c=>c.id===entry.caseId)||seen.has(entry.caseId)||!['browser','agent','manual'].includes(entry.mode)||!text(entry.reason,3000)||!Array.isArray(entry.steps)||entry.steps.length>50)throw new Error('Invalid or duplicate case in the execution plan.');
  seen.add(entry.caseId);
  if(entry.mode==='agent'&&!batch.agent?.mappings.some(m=>m.caseId===entry.caseId&&executionOrigin(m.targetUrl)===executionOrigin(batch.environment)))throw new Error('An agent plan needs an existing mapping to this test environment.');
  if(entry.mode==='manual'&&!entry.reason.trim())throw new Error('Explain why a case needs manual review.');
  if(entry.mode!=='browser'&&entry.steps.length)throw new Error('Only browser cases can contain browser actions.');
  for(const step of entry.steps) {
   if(!step||!actions.includes(step.action)||!['role','label','text','placeholder','testId','css'].includes(step.by)||!text(step.locator,1000)||!text(step.name,1000)||!text(step.value,3000))throw new Error('Invalid browser action.');
   if(step.action==='navigate'&&executionOrigin(new URL(step.value,batch.environment).href)!==executionOrigin(batch.environment))throw new Error('Browser navigation must stay within the approved test environment.');
   if(step.action==='count'&&!/^\d+$/.test(step.value))throw new Error('A count assertion needs a whole number.');
  }
  if(entry.mode==='browser'&&!entry.steps.some((step:BrowserStep)=>assertionActions.has(step.action)))throw new Error('Each browser case needs an observable assertion.');
 }
}
export const approvalSignature=(batch:CodexBatch)=>JSON.stringify([batch.runId,batch.environment,batch.build,batch.cases.map(c=>c.fingerprint),batch.plan]);
export function validateCodexBatch(batch:any):asserts batch is CodexBatch {
 if(!batch||batch.format!=='qa-avatar-codex-v1'||!text(batch.runId,36)||!/^[0-9a-f-]{36}$/i.test(batch.runId)||!text(batch.projectId,1000)||!text(batch.projectName,1000)||!text(batch.environment,1000)||!text(batch.build,1000)||!text(batch.avatarId,1000)||!text(batch.createdAt,100)||!statuses.includes(batch.status)||!Array.isArray(batch.cases)||!batch.cases.length||batch.cases.length>10||new Set(batch.cases.map((c:any)=>c.id)).size!==batch.cases.length)throw new Error('Invalid Codex batch.');
 executionOrigin(batch.environment);
 for(const c of batch.cases) {
  for(const field of ['id','title','steps','expected','source'])if(!text(c[field]))throw new Error('Invalid Codex case snapshot.');
  if(!text(c.fingerprint,85000)||c.fingerprint!==fingerprint(c))throw new Error('Invalid Codex case fingerprint.');
 }
 if(batch.plan!==undefined)validateCodexPlan(batch.plan,batch);
 for(const field of ['approval','report'])if(batch[field]!==undefined&&!text(batch[field],500000))throw new Error('Codex report or approval is too large.');
 for(const field of ['workerId','message','finishedAt'])if(batch[field]!==undefined&&!text(batch[field],3000))throw new Error('Invalid Codex batch metadata.');
 if(['approved','running','completed'].includes(batch.status)&&(!batch.plan||batch.approval!==approvalSignature(batch)))throw new Error('Approve the current execution plan before running.');
 if(['approved','running','completed'].includes(batch.status)&&batch.plan?.every((entry:CodexPlan)=>entry.mode==='manual'))throw new Error('Prepare at least one executable case before approving this batch.');
 if(batch.results!==undefined) {
  if(!Array.isArray(batch.results)||batch.results.length!==batch.cases.length||new Set(batch.results.map((r:any)=>r.id)).size!==batch.cases.length)throw new Error('Results must include every case exactly once.');
  for(const r of batch.results) {
   const c=batch.cases.find((item:any)=>item.id===r.id);
   if(!c||r.fingerprint!==c.fingerprint||!['Pass','Fail','Blocked','Needs clarification'].includes(r.status)||!text(r.actual)||!text(r.evidence)||!r.actual.trim()||!Number.isSafeInteger(r.assertions)||r.assertions<0||(r.status==='Pass'&&(!r.assertions||!r.evidence.trim())))throw new Error('Invalid Codex execution result.');
  }
 }
 if(batch.status==='completed'&&(!batch.results||!batch.report))throw new Error('A completed batch needs its results and report.');
}
export function applyCodexResults(project:Project,batch:CodexBatch):Project {
 validateCodexBatch(batch);assertCurrentBatch(batch,project);
 if(batch.status!=='completed'||!batch.results)throw new Error('The batch has not finished.');
 const cases=project.cases.map(c=>{const result=batch.results!.find(r=>r.id===c.id);return result?{...c,status:result.status,actual:result.actual,evidence:result.evidence}:c;});
 const bugs=[...project.bugs];
 for(const result of batch.results.filter(r=>r.status==='Fail')) {
  const existing=bugs.findIndex(b=>b.caseId===result.id);
  if(existing>=0)bugs[existing]={...bugs[existing],status:'Open'};
  else {const c=cases.find(c=>c.id===result.id)!;bugs.push({id:'BUG-'+crypto.randomUUID().slice(0,8),caseId:c.id,title:c.title,severity:c.priority,status:'Open',details:'Steps: '+c.steps+'\nExpected: '+c.expected+'\nActual: '+c.actual+'\nEvidence: '+c.evidence});}
 }
 return {...project,cases,bugs,codex:batch};
}
export function codexReport(batch:CodexBatch):string {
 const escape=(value:string)=>value.replace(/[\r\n]+/g,' ').replace(/[\\`*_<>#\[\]]/g,'\\$&');
 return '# '+escape(batch.projectName)+' — Test Execution Report\n\nRun '+batch.runId+'\n\nEnvironment '+escape(batch.environment)+'\n\nBuild '+escape(batch.build||'Unspecified')+'\n\nFinished '+batch.finishedAt+'\n\n'+['Pass','Fail','Blocked','Needs clarification'].map(status=>status+' — '+batch.results!.filter(r=>r.status===status).length).join('\n\n')+'\n\n'+batch.results!.map(r=>{const c=batch.cases.find(c=>c.id===r.id)!;return '## '+escape(c.id)+' — '+escape(c.title)+'\n\nStatus '+r.status+'\n\nRequirements '+escape(c.requirementIds?.join(', ')||c.source)+'\n\nPrecondition\n\n'+escape(c.preconditions||'Not specified')+'\n\nSteps\n\n'+escape(c.steps)+'\n\nTest data\n\n'+escape(c.testData||'Not specified')+'\n\nExpected result\n\n'+escape(c.expected)+'\n\nActual result\n\n'+escape(r.actual)+'\n\nEvidence\n\n'+escape(r.evidence||'No browser execution evidence.');}).join('\n\n');
}
