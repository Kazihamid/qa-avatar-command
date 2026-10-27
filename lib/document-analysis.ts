import {analyzeBusinessProcess,type ProcessReview} from './process-analysis';
import {actionExample,capitalizeRequirement} from './case-title';
import type {Case} from './model';
export type Requirement={id:string;reference?:string;statement:string;source:string};
export type RequirementGap={reference:string;originalText:string;question:string;kind?:'inconsistency'|'clarification'};
export type Analysis={processReview?:ProcessReview;gapDetails?:RequirementGap[];mode:'rules'|'ai';summary?:string;requirements:Requirement[];gaps:string[];regressionSuggestions?:string[];cases:Case[];partial:boolean;reviewedCharacters:number};
// Lines that are structure or legal boilerplate, not testable requirements.
const BOILERPLATE=/\b(confidential(ity)?|proprietary|copyright|all rights reserved|intended (solely )?for|unauthori[sz]ed (use|disclosure|copying)|do not (copy|distribute|disclose)|without (the )?(prior )?(written )?(consent|permission)|disclaimer|document (control|history|number|id)|version history|revision history|change (log|history)|prepared by|reviewed by|approved by|distribution list)\b/i;
const LEGAL_NOTICE=/\b(all rights reserved|prior written (?:consent|permission)|must not be disclosed|copyright|this document (?:and|is|may)|without.*permission.*(?:document|BRAC))\b/i;
const unfinished=(value:string)=>/\b(?:will be|shall be|must be|can be|may be|will|shall|must|and|or|either|into|with|without|of|to|the|a|an|is|are|be|no longer)\s*[,;:]?$/i.test(value)||/[,:]$/.test(value);
function rewriteRequirement(value:string,context:string):string {
 let result=value.replace(/^[-•]\s*/,'').replace(/\s+/g,' ').trim();
 const merge=result.match(/^(.+?)\s+(?:will|shall|must)\s+be\s+merged\s+into\s+(.+?)[.]?$/i);
 if(merge){let subject=merge[1];
  if(/two optional (?:NID|National ID) fields/i.test(subject)&&/National ID\s*\(Previous\)/i.test(context)&&/National ID\s*\(Smart\)/i.test(context))subject='the National ID (Previous) and National ID (Smart) fields';
  else subject=subject.charAt(0).toLowerCase()+subject.slice(1);
  result='The system must merge '+subject+' into '+merge[2].replace(/[.]$/,'')+'.';
 }
 result=result.replace(/^User\s+(?:will|shall|must)\s+input numeric digits in the ([^.]+)[.]?/i,'Users must enter numbers in the $1.').replace(/^(?:the\s+)?system\s+(?:will|shall)\s+/i,'The system must ').replace(/^User\s+(will|can|may|must)\s+/i,'Users $1 ');
 result=result.replace(/\bshall\b/gi,'must').replace(/\bmust not be greater than\b/gi,'must not exceed');
 if(!/[.!?]$/.test(result))result+='.';
 return capitalizeRequirement(actionExample(result));
}
function isNoise(line:string):boolean{
 if(LEGAL_NOTICE.test(line))return true;
 if(/\.{4,}\s*\d+$/.test(line))return true;                       // table-of-contents entry
 if(BOILERPLATE.test(line)&&!(/\b(must|shall|should|will|required|mandatory|allow|prevent|block|validate|when|then|if|cannot)\b/i.test(line)))return true;                              // legal / document-control text
 if(/^(page\s+)?\d+\s*(of|\/)\s*\d+$/i.test(line))return true;      // page x of y
 const words=line.split(' ').length;const hasSentenceCue=/[.;:]$/.test(line)||/\b(must|shall|should|will|required|mandatory|allow|prevent|block|validate|when|then|if|cannot|can|may)\b/i.test(line);
 if(!hasSentenceCue&&words<=10&&(/^(\d+(\.\d+)*\.?\s+)?[A-Z][A-Za-z0-9 &/,()'-]*$/.test(line)||line===line.toUpperCase()))return true; // heading / title with no requirement wording
 return false;
}
type SourceRequirement={text:string;source:string;line:number;reference:string;originalText:string};
export function extractRequirements(text:string,filename:string,incompleteGaps:string[]=[]):SourceRequirement[] {
 const clean=(value:string)=>value.trim().replace(/^[|\s*#]+|[|\s*]+$/g,'').replace(/^[•●▪]\s*|^o\s+(?=[A-Z])/,'').replace(/\s+/g,' ');
 const prefixOf=(value:string)=>value.match(/^((?:(?:REQ|FR|NFR|BR|SR|Requirement|Business Rule)[ _-]*\d+(?:\.\d+)*|\d+(?:\.\d+)*[.)]?|\([a-zivx0-9]+\)|[a-z][.)]|[ivxlcdm]+[.)]))(?=\s|[:|])(?:\s*[:|]\s*|\s+)/i);
 const metadata=(value:string)=>LEGAL_NOTICE.test(value)||BOILERPLATE.test(value)||/^(?:\d{1,2}[-/](?:[A-Za-z]{3,9}|\d{1,2})[-/]\d{2,4}\b|Pg\.?\s*[|:]?\s*\d+|CMMI|ISO\s*\d|(?:prepared|reviewed|approved) by\b|version\s+\d)/i.test(value);
 const normative=(value:string)=>/\b(must|shall|should|will|required|mandatory|cannot)\b/i.test(value)||/\b(?:system|application|users?|employees?|administrator)\s+(?:can|may)\b/i.test(value)||/^(?:allow|reject|prevent|block|display|hide|enable|disable|validate|save|create|update|delete|restrict|require)\s+\S+/i.test(value);
 const notApplicable=(value:string)=>/^(?:(?:[^:;\n]+?)\s*[:–—-]\s*)?(?:n\s*\/\s*a|not applicable)\s*[.;]?$/i.test(value)&&!normative(value);
 const sectionName=/^(?:input|process|output|validations?|business rules?(?:\s*\/\s*validations?)?|acceptance criteria|employee info section|functional requirements?|requirements?|proposed changes|use cases?)$/i;
 const lines=text.split(/\n/),result:SourceRequirement[]=[],seen=new Set<string>();
 let page='',contextSection=false;let headings:{label:string;level:number}[]=[];
 let list:{text:string;subject:string;kind:'field'|'column'}|undefined;
 const reference=(line:number,end=line,item='')=>{
  const path=[...headings.map(h=>h.label),...(item?[item.replace(/[.]$/,'')]:[])].join('\\');
  const location='Line '+line+(end>line?'–'+end:'');
  return (page?page+(path?' | ':' | '):'')+(path?path+': ':'')+location;
 };
 for(let i=0;i<lines.length;i++){
  const firstLine=i+1;let line=clean(lines[i]);
  if(!line)continue;
  if(/^(?:n\s*\/\s*a|not applicable|none|[-–—]+)\.?$/i.test(line))continue;
  if(/^\[Page \d+\]$/.test(line)){page=line.slice(1,-1);continue;}
  if(metadata(line)||/\.{4,}\s*\d+$/.test(line))continue;
  const prefix=prefixOf(line);let body=prefix?line.slice(prefix[0].length):line;
  if(notApplicable(body))continue;
  const name=body.replace(/[:.]+$/,'').trim();
  const contextual=/^(?:(?:cr|srs)\s+)?(?:title|description|overview|introduction|background|purpose|objectives?|summary|scope|document history|CR accumulation|commercial terms|billing details|document approval)$/i.test(name);
  const heading=sectionName.test(name)||contextual||(!!prefix&&!normative(body)&&!unfinished(body)&&body.split(' ').length<=10&&isNoise(body));
  if(heading){
   const multi=prefix&&/^\d+\.\d/.test(prefix[1]);
   const rootLevel=multi?prefix[1].replace(/[.)]$/,'').split('.').length:undefined;
   const dottedParent=[...headings].reverse().find(h=>/^\d+\.\d/.test(h.label));
   const level=(!prefix&&/^(?:(?:functional|business|system|detailed|software)\s+)?requirements?$/i.test(name))?1:rootLevel||(dottedParent?dottedParent.level+1:1);
   const printed=prefix?.[1]||'';
   const number=multi?printed.replace(/\.$/,''):printed;
   const label=(number?number+' ':'')+name;
   headings=headings.filter(h=>h.level<level);headings.push({label,level});list=undefined;
   if(contextual)contextSection=true;else if(/requirement|business rule|acceptance|proposed/i.test(name))contextSection=false;
   continue;
  }
  if(contextSection)continue;
  if(/\b(?:effort given|CR categor|AMC|contract payment|billing)\b/i.test(body)&&!/(?:system|application|user|admin)\b/i.test(body))continue;
  // A colon introduces content; it does not make a heading or list introduction a broken sentence.
  if(/:$/.test(body)){
   const fields=body.match(/^(.+?)\s+(?:shall|must|will)\s+(?:contain|include|display|show)\s+(?:the\s+)?following\s+(fields|columns)\b/i);
   list=fields?{text:body,subject:fields[1],kind:/column/i.test(fields[2])?'column':'field'}:undefined;
   // Content below the introduction is reviewed in its own right.
   continue;
  }
  if(list&&!normative(body)){
   const entry=body.replace(/^[-•]\s*/,'').replace(/\*/g,'').trim();
   const parts=entry.split(/\s+[–—-]\s+/);const field=parts[0].replace(/[.;]$/,'');
   if(field&&field.split(' ').length<=10){
    const description=parts.slice(1).join(' ').replace(/^(?:new|existing) field\s*(?:to\s*)?/i,'').replace(/[.]$/,'');
    body=list.subject+' must '+(list.kind==='column'?'display ':'include ')+(/existing field/i.test(parts.slice(1).join(' '))?'the existing ':'a ')+field+' '+list.kind+(description?' to '+description:'')+'.';
   }
  }
  if(!normative(body)&&!unfinished(body)&&!/^(?:merged|shown|displayed)\b/i.test(body))continue;
  // Join wrapped prose without absorbing the next heading, bullet or independent requirement.
  for(let count=0;count<10&&i+1<lines.length;count++){
   const rawNext=lines[i+1].trim(),next=clean(rawNext);
   if(notApplicable(next))break;
   if(!next||/^\[Page \d+\]$/.test(next)||metadata(next)||prefixOf(next)||/^[•●▪-]\s|^o\s+(?=[A-Z])/.test(rawNext)||sectionName.test(next.replace(/:$/,'')))break;
   if(isNoise(next)&&!unfinished(next))break;
   const independent=/^(?:the\s+)?(?:system|application|users?|employees?)\s+(?:must|shall|will|can|may)\b/i.test(next);
   const continuation=unfinished(body)||(!/[.!?]$/.test(body)&&/^[a-z(]/.test(next));
   if(!continuation||independent||body.length+next.length>3000)break;
   body+=' '+next;i++;
  }
  const item=prefix?.[1]||'';
  const location=reference(firstLine,i+1,item);
  if(unfinished(body)||/^(?:merged|shown|displayed|must|shall|will|can either)\b/i.test(body)){
   if(incompleteGaps.length<100)incompleteGaps.push(location+': What should happen here? The text stops at “'+body+'”. Add the rest of the rule so it can be reviewed.');
   continue;
  }
  if(body.length<12||body.length>3000||metadata(body))continue;
  if(/^(?:test\s+title|document\s+title|change\s+request\s+title)\b|^(?:CR|SRS)[_-]|^(?:this (?:change|document|request)|the (?:purpose|objective)|providing\b)/i.test(body))continue;
  if(!normative(body))continue;
  const normalized=[headings.map(h=>h.label).join('/'),item,body.toLowerCase()].join('|');if(seen.has(normalized))continue;seen.add(normalized);
  result.push({text:rewriteRequirement(body,lines.slice(firstLine-1,i+7).join(' ')),reference:location,source:filename+' · '+location,line:firstLine,originalText:lines.slice(firstLine-1,i+1).join('\n').trim()});
 }
 return result;
}
export function analyzeRequirements(text:string,filename:string):Analysis {
 if(typeof text!=='string'||!text.trim())throw new Error('No text available for analysis.');
 if(text.length>200000)throw new Error('Document text exceeds 200,000 characters. Split the document into smaller sections.');
 const incompleteGaps:string[]=[];
 const identified=extractRequirements(text,filename,incompleteGaps),selected=identified.slice(0,500),partial=identified.length>500;
 if(!selected.length&&!incompleteGaps.length)throw new Error('No explicit requirements found. Add requirement statements or a Requirements / Business Rules section; titles and descriptions are not drafted.');
 const requirements=selected.map(r=>({id:'line-'+r.line,reference:r.reference,statement:r.text,source:r.source}));
 const gaps:string[]=[...incompleteGaps];
 const gapLabel=(reference='')=>reference+(reference.endsWith('.')?' ':': ');
 const quote=(value:string)=>'“'+value.replace(/^\d+(?:\.\d+)*[.)]?\s+/,'').trim().slice(0,180)+(value.length>180?'…':'')+'”';
 for(const r of requirements){
  const s=r.statement.replace(/^\d+(?:\.\d+)*[.)]?\s+/,'');
  const unclear=s.match(/\b(tbd|tbc|appropriate|as needed|fast|quickly|user-friendly|etc)\b/i);
  if(unclear){const word=unclear[0];let question='What does '+quote(word)+' mean here? State the exact behavior or conditions that are acceptable.';
   if(/fast|quickly/i.test(word))question='How quickly should this happen? Give the longest acceptable response time.';
   else if(/tbd|tbc/i.test(word))question='What decision is still needed for '+quote(word)+'? Add the agreed rule before finalizing this requirement.';
   else if(/etc/i.test(word))question='Which other items does '+quote(word)+' include? List them so the scope is clear.';
   gaps.push(gapLabel(r.reference)+question+' Requirement: '+quote(s));
  }
  if(/\b(maximum|minimum|limit|length|threshold)\b/i.test(s)&&!(/\d/.test(s))&&!/field to define|configured score range|configurable/i.test(s))gaps.push(gapLabel(r.reference)+'What is the allowed limit? Give the minimum or maximum value, its unit, and whether the endpoint is allowed. Requirement: '+quote(s));
  if(/\b(error|failure|unavailable|timeout|exception)\b/i.test(s)&&!(/\b(retry|recover|rollback|message|retain|discard)\b/i.test(s))){
   const condition=s.match(/\b(?:when|if)\s+(.+?)[.!]?$/i)?.[1];
   gaps.push(gapLabel(r.reference)+(condition?'What should happen if '+condition.replace(/[.]$/,'')+'?':'What should the user see when this action fails?')+' Specify the message, whether entered data is kept, and how the user can try again. Requirement: '+quote(s));
  }
 }
 for(let i=0;i<requirements.length;i++)for(let j=i+1;j<requirements.length;j++){
  const normalize=(value:string)=>value.toLowerCase().replace(/\b(must|shall|should|will)\s+(?:not\s+)?/g,'').replace(/\W/g,'');
  const first=requirements[i],second=requirements[j];
  if(normalize(first.statement)===normalize(second.statement)&&/\bnot\b/i.test(first.statement)!==/\bnot\b/i.test(second.statement))gaps.push(first.reference+' and '+second.reference+' disagree: '+quote(first.statement)+' / '+quote(second.statement)+'. Which rule should the system follow?');
 }
 const summary=partial?'Found '+identified.length+' possible requirements. This review covers the first '+requirements.length+'. Review the remaining '+(identified.length-requirements.length)+' in a separate section or file. No test cases have been created.':'Found '+requirements.length+' requirements to review. Check the questions below, then edit and finalize the list. No test cases have been created.';
 const gapDetails=gaps.slice(0,200).map(gap=>{
  const related=identified.filter(item=>gap.startsWith(item.reference+':')||gap.startsWith(item.reference+' and ')||gap.includes(' and '+item.reference+' disagree:'));
  const location=gap.match(/^(.*?Line \d+(?:[–-]\d+)?): /)?.[1]||'';
  const reference=related.length?related.map(item=>item.reference).join(' / '):location;
  const range=location.match(/Line (\d+)(?:[–-](\d+))?/);
  const originalText=related.length?related.map(item=>item.originalText).join('\n\n'):range?text.split('\n').slice(Number(range[1])-1,Number(range[2]||range[1])).join('\n').trim():'';
  let question=gap.startsWith(reference+': ')?gap.slice(reference.length+2):location?gap.slice(location.length+2):gap;
  question=question.replace(/\s+Requirement:.*$/s,'');
  if(!related.length&&/text stops at/.test(question)){
   if(/matched with[,;]?$/i.test(originalText))question='What should this value be matched with? Name the data or records the system must check.';
   else if(/\band[,;]?$/i.test(originalText))question='What other action or condition belongs here? Complete the sentence so the full rule is clear.';
   else if(/^merged\b/i.test(originalText))question='Which fields or items must be merged? Name them in the requirement.';
   else question='What action or result is missing? Complete this rule so it can be understood on its own.';
  }
  if(related.length>1)question='These requirements give different instructions. Which rule should the system follow?';
  return {reference,originalText,question,kind:related.length>1?'inconsistency' as const:'clarification' as const};
 });
 const processReview=analyzeBusinessProcess(identified.map(item=>({id:'line-'+item.line,text:item.text,reference:item.reference})),text);
 return {mode:'rules',processReview,summary,requirements,gaps:gaps.slice(0,200),gapDetails,cases:[],partial,reviewedCharacters:text.length};
}
export const allowedExtensions=['pdf','docx','txt','md'];
export function validateUpload(name:string,size:number,bytes:Uint8Array):{extension:string;mime:string}{
 const extension=name.split('.').pop()?.toLowerCase()||'';if(!allowedExtensions.includes(extension))throw new Error('Use PDF, DOCX, TXT or MD. Legacy DOC files are not supported.');if(size<=0||size>10*1024*1024)throw new Error('Choose a nonempty file up to 10 MB.');
 if(extension==='pdf'&&!new TextDecoder().decode(bytes.slice(0,1024)).includes('%PDF-'))throw new Error('File is not a valid PDF.');
 if(extension==='docx'&&!(bytes[0]===0x50&&bytes[1]===0x4b))throw new Error('File is not a valid DOCX archive.');
 if(['txt','md'].includes(extension)&&bytes.slice(0,10000).some(b=>b===0))throw new Error('Text file contains binary data.');
 return {extension,mime:extension==='pdf'?'application/pdf':extension==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'text/plain'};
}
