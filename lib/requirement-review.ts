import {validateProcessReview,type ProcessReview} from './process-analysis';
import type {RequirementGap} from './document-analysis';
import type {Case} from './model';
import {actionTitle} from './case-title';

export type ReviewRequirement={reference?:string;id:string;statement:string;source:string;included:boolean};
export type RequirementReview={testCasesWrittenFor?:string;processReview?:ProcessReview;gapDetails?:RequirementGap[];documentId:string;documentName:string;mode:'rules'|'ai';summary:string;gaps:string[];requirements:ReviewRequirement[];finalized:boolean};

export function requirementCaseSignature(review:RequirementReview):string {
 return JSON.stringify([review.documentId,review.requirements.filter(r=>r.included).map(r=>[r.id,r.statement]).sort((a,b)=>a[0].localeCompare(b[0]))]);
}
export function hasWrittenRequirementCases(review:RequirementReview,cases:Case[]):boolean {
 if(review.testCasesWrittenFor!==undefined)return review.testCasesWrittenFor===requirementCaseSignature(review);
 const selected=review.requirements.filter(r=>r.included);
 return selected.length>0&&selected.every(r=>cases.some(c=>c.requirementIds?.includes(r.reference||r.id)&&c.expected===r.statement));
}

export function validateRequirementReview(value:any):asserts value is RequirementReview {
 const text=(v:unknown,max=20000)=>typeof v==='string'&&v.length<=max;
 if(value?.testCasesWrittenFor!==undefined&&!text(value.testCasesWrittenFor,2000000))throw new Error('Invalid test case requirement signature.');
 if(!value||!text(value.documentId,300)||!text(value.documentName,500)||!['rules','ai'].includes(value.mode)||!text(value.summary)||typeof value.finalized!=='boolean'||!Array.isArray(value.gaps)||value.gaps.length>200||value.gaps.some((g:unknown)=>!text(g))||!Array.isArray(value.requirements)||value.requirements.length>500||new Set(value.requirements.map((r:any)=>r.id)).size!==value.requirements.length)throw new Error('Invalid requirement review.');
 if(value.processReview!==undefined)validateProcessReview(value.processReview);
 if(value.gapDetails!==undefined&&(!Array.isArray(value.gapDetails)||value.gapDetails.length>200||value.gapDetails.some((gap:any)=>!gap||!text(gap.reference,3000)||!text(gap.originalText,20000)||!text(gap.question,20000))))throw new Error('Invalid gap source details.');
 for(const r of value.requirements)if((r.reference!==undefined&&!text(r.reference,300))||!text(r.id,100)||!r.id||!text(r.statement,3000)||!r.statement.trim()||!text(r.source,3000)||typeof r.included!=='boolean')throw new Error('Each requirement needs a statement and source reference.');
 if(value.finalized&&!value.requirements.some((r:ReviewRequirement)=>r.included))throw new Error('Select at least one requirement before finalizing.');
}

/** Called only by the explicit Write Test Cases action, using the persisted final list. */
export function writeReviewedTestCases(review:RequirementReview):Case[] {
 validateRequirementReview(review);
 if(!review.finalized)throw new Error('Finalize the reviewed requirement list before writing test cases.');
 const cases:Case[]=[],seen=new Map<string,Case>();
 const add=(r:ReviewRequirement,kind:string,title:string,testData:string,steps:string,expected:string)=>{
  const label=r.reference||r.id;
  const concise=actionTitle(title),key=concise.toLowerCase()+'|'+testData.split(label).join('[requirement]')+'|'+expected.split(label).join('[requirement]');
  if(seen.has(key)){const existing=seen.get(key)!;existing.requirementIds=[...new Set([...existing.requirementIds!,label])];existing.source+='; '+r.source+' · '+label;return;}
  const c:Case={id:'DOC-'+crypto.randomUUID().slice(0,8),title:concise,preconditions:'The requirement does not describe the setup. Confirm what needs to be ready before running this test.',testData,steps,expected,actual:'',status:'Not run',priority:kind==='negative'?'High':'Medium',source:r.source+' · '+label+' / '+kind,requirementIds:[label],evidence:''};
  cases.push(c);seen.set(key,c);
 };
 for(const r of review.requirements.filter(r=>r.included)){
  const label=r.reference||r.id;
  const statement=r.statement.replace(/^\d+(?:\.\d+)*[.)]?\s+/,'');
  const subject=statement.match(/\b(NID|email|password|phone|date|amount|file|profile|permission|record)\b/i)?.[0]||'required behavior';
  const quoted=[...statement.matchAll(/[“"‘']([^“”"‘’']+)[”"’']/g)].map(m=>m[1]);
  const prohibited=/\b(must not|shall not|cannot|not allowed|reject|prevent|block)\b/i.test(statement);
  add(r,prohibited?'negative':'positive',prohibited?'Enforce '+subject+' restrictions':statement,quoted.length?'Values listed in the requirement: '+quoted.join(', '):'The requirement does not give example values. Choose values that follow its rules.',
   '1. Review requirement '+label+': '+statement+'\n2. Carry out the action in this requirement using valid data.\n3. Check that the result matches the requirement.',statement);
  if(/\b(numeric|only digits)\b/i.test(statement))add(r,'negative','Reject nonnumeric '+subject,'Letters and symbols in the numeric '+subject+' field.','1. Enter nonnumeric content in '+subject+'.\n2. Carry out the action described in '+label+'.\n3. Check how the system handles the invalid value.','The system rejects letters and symbols, as required by '+label+': '+statement);
  if(/\b(mandatory|required)\b/i.test(statement))add(r,'negative','Reject missing '+subject,'Leave the required '+subject+' value empty.','1. Omit the required '+subject+' value.\n2. Carry out the action described in '+r.id+'.\n3. Check that the system asks for the missing value.','The system requires a value for this field. Requirement: '+statement);

  const threshold=statement.match(/\b(maximum|minimum|max|min|up to)\s+(?:length\s+)?(?:of\s+)?(\d+)\s*(digits|characters|items|records|files|days)?\b/i);
  if(threshold&&threshold[3]){const n=Number(threshold[2]),maximum=/^(maximum|max|up to)$/i.test(threshold[1]),unit=threshold[3]||'units';
   if(Number.isSafeInteger(n)&&n>=0)for(const delta of [-1,0,1]){const value=n+delta;if(value<0)continue;const accepted=maximum?value<=n:value>=n;
    add(r,'boundary','Check '+subject+' at '+value+' '+unit,value+' '+unit+'; '+threshold[1]+' '+n+' '+unit+'.','1. Prepare '+subject+' with '+value+' '+unit+'.\n2. Carry out the action described in '+r.id+'.\n3. Check whether the system accepts or rejects the value as required.','The system '+(accepted?'accepts':'rejects')+' '+value+' '+unit+'. The '+(maximum?'maximum':'minimum')+' allowed is '+n+' '+unit+'. Requirement: '+statement);
   }
  }
 }
 return cases;
}
