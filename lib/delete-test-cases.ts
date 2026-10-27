import type {Project} from './model';
import {moveStage,stages,workflow} from './lifecycle';

export function deleteTestCases(project:Project,caseIds:readonly string[]):Project {
 const ids=new Set(caseIds.filter(id=>project.cases.some(c=>c.id===id)));
 if(!ids.size)return project;
 // A changed suite needs approval again before execution can continue.
 const base=stages.indexOf(workflow(project).stage)>stages.indexOf('Preparing Tests')
  ?moveStage(project,'Preparing Tests','Deleted '+ids.size+' test case(s); review the updated test suite before execution.')
  :project;
 const w=workflow(base);
 return {...base,
  cases:base.cases.filter(c=>!ids.has(c.id)),
  bugs:base.bugs.map(b=>ids.has(b.caseId)?{...b,caseId:''}:b),
  execution:base.execution?{...base.execution,mappings:base.execution.mappings.filter(m=>!ids.has(m.caseId)),lastJob:undefined,importedAt:undefined}:undefined,
  workflow:{...w,testsApproved:false,retestCaseIds:w.retestCaseIds.filter(id=>!ids.has(id)),retests:w.retests.filter(r=>!ids.has(r.caseId)),regression:w.regression.filter(r=>!ids.has(r.caseId))},
 };
}
