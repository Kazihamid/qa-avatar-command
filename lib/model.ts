import {validateRequirementReview,type RequirementReview} from './requirement-review';
import {validateWorkflow,workflowReport,workflow,type Workflow} from './lifecycle';
import {validateExecution,type ExecutionConfig} from './execution-model';
export const statuses=['Not run','Pass','Fail','Blocked','Needs clarification'] as const;
export type Case={preconditions?:string;testData?:string;requirementIds?:string[];id:string;title:string;steps:string;expected:string;actual:string;status:string;priority:string;source:string;evidence:string};
export type Avatar={id:string;name:string;role:string;color:string};
export type Bug={id:string;title:string;severity:string;status:string;caseId:string;details:string};
export type Project={id:string;name:string;environment:string;build:string;avatarId:string;requirements:string;cases:Case[];bugs:Bug[];execution?:ExecutionConfig;requirementReview?:RequirementReview;workflow?:Workflow};
export type Workspace={avatars:Avatar[];projects:Project[]};
export function validateState(s:any): asserts s is Workspace {
 if(!s||!Array.isArray(s.avatars)||!Array.isArray(s.projects)||s.avatars.length>30||s.projects.length>50) throw new Error('Invalid workspace');
 const str=(v:any,n=20000)=>{if(typeof v!=='string'||v.length>n)throw new Error('Invalid or oversized text');};
 const unique=(a:any[])=>{if(new Set(a.map(x=>x.id)).size!==a.length)throw new Error('Duplicate IDs');};unique(s.avatars);unique(s.projects);
 for(const a of s.avatars){for(const k of ['id','name','role','color'])str(a[k],300);if(!/^#[0-9a-fA-F]{6}$/.test(a.color))throw new Error('Invalid avatar color');if(!a.name.trim())throw new Error('Avatar name required');}
 for(const p of s.projects){for(const k of ['id','name','environment','build','avatarId'])str(p[k],1000);str(p.requirements,100000);if(!p.name.trim())throw new Error('Project name required');if(p.avatarId&&!s.avatars.some((a:any)=>a.id===p.avatarId))throw new Error('Unknown avatar');if(!Array.isArray(p.cases)||!Array.isArray(p.bugs)||p.cases.length>2000||p.bugs.length>1000)throw new Error('Invalid cases/bugs');unique(p.cases);unique(p.bugs);
 if(p.requirementReview)validateRequirementReview(p.requirementReview);
 if(p.execution)validateExecution(p.execution,p.id,p.cases.map((c:any)=>c.id));
 for(const c of p.cases){for(const k of ['id','title','steps','expected','actual','status','priority','source','evidence'])str(c[k]);for(const k of ['preconditions','testData'])if(c[k]!==undefined)str(c[k]);if(c.requirementIds!==undefined&&(!Array.isArray(c.requirementIds)||c.requirementIds.length>100||c.requirementIds.some((id:unknown)=>typeof id!=='string'||id.length>1000)))throw new Error('Invalid requirement traceability');if(!statuses.includes(c.status as any)||!['High','Medium','Low'].includes(c.priority)||!c.title.trim())throw new Error('Invalid test case');}
 for(const b of p.bugs){for(const k of ['id','title','severity','status','caseId','details'])str(b[k]);if(!['High','Medium','Low'].includes(b.severity)||!['Open','Fixed','Closed'].includes(b.status))throw new Error('Invalid defect');}
 validateWorkflow(p);
 }
}
export function report(p:Project,a?:Avatar){const count=(s:string)=>p.cases.filter(c=>c.status===s).length;return '# '+p.name+' — QA report\n\nEnvironment: '+(p.environment||'Not specified')+'\nBuild: '+(p.build||'Not specified')+'\nAssigned avatar: '+(a?.name||'Unassigned')+'\nExported: '+new Date().toISOString()+'\n\nExecution: outcomes are entered by the lead or imported from a local agent run. Check case evidence and run provenance; this report does not verify a continuous runner connection.\n\n'+statuses.map(s=>s+': '+count(s)).join('\n')+'\n\nOpen defects: '+p.bugs.filter(b=>b.status!=='Closed').length+'\n\nRelease review: '+(workflow(p).stage==='Completed'?'QA cycle completed; lead decision recorded':'QA cycle incomplete; follow the remaining lifecycle stages')+workflowReport(p)+'\n\n## Test results\n\n'+p.cases.map(c=>'### '+c.id+' — '+c.title+'\nStatus: '+c.status+'\nPreconditions: '+(c.preconditions||'Not specified')+'\nTest data: '+(c.testData||'Not specified')+'\nRequirements: '+(c.requirementIds?.join(', ')||c.source)+'\nSteps: '+c.steps+'\nExpected: '+c.expected+'\nActual: '+(c.actual||'Not recorded')+'\nEvidence: '+(c.evidence||'Not supplied')+'\n').join('\n')+'\n## Defects\n\n'+p.bugs.map(b=>'### '+b.id+' — '+b.title+'\n'+b.severity+' / '+b.status+'\n'+b.details+'\n').join('\n');}
