export type ProcessEvidence={text:string;reference:string;requirementId:string};
export type ProcessArea={name:string;status:'Found'|'Not stated';items:ProcessEvidence[];values?:string[]};
export type BusinessScenario={title:string;requirementIds:string[];activities:ProcessEvidence[];decisions:ProcessEvidence[];alternateFlows:ProcessEvidence[];exceptionFlows:ProcessEvidence[];reviewPoints:string[]};
export type ProcessReview={areas:ProcessArea[];scenarios:BusinessScenario[];improvements:{topic:string;question:string;references:string[]}[];coverage:{area:string;status:string;explanation:string}[];limitations:string[]};
type Input={id:string;text:string;reference:string};

export function analyzeBusinessProcess(requirements:Input[],documentText:string):ProcessReview {
 const evidence=(r:Input):ProcessEvidence=>({text:r.text,reference:r.reference,requirementId:r.id});
 const definitions:[string,RegExp][]=[
  ['Business actors',/\b(user|admin|administrator|employee|manager|supervisor|approver|reviewer|customer|operator|HR|applicant)\b/i],
  ['Business activities',/\b(configur\w*|creat\w*|submit\w*|approv\w*|calculat\w*|assign\w*|review\w*|updat\w*|register\w*)\b/i],
  ['Workflow',/\\(?:\d+[.)]?\s+)?Process\b|\b(before|after|then|upon|workflow|submit|saving)\b/i],
  ['Decision points',/\b(if|when|unless|otherwise|greater|less|within|exceed|equal|between)\b/i],
  ['Alternate flows',/\b(otherwise|else|alternate|optional|cancel|rejoin|inactive|override)\b/i],
  ['Exception flows',/\b(error|fail(?:s|ed|ure|ures)?|exception|timeout|unavailable|retry|rollback)\b/i],
  ['System interactions',/\b(screen|form|field|column|button|display|input|output|save|store|retrieve)\b/i],
  ['Integrations',/\b(API|integration|external system|third-party service|webhook|sync|synchroni\w*)\b/i],
  ['Status transitions',/\b(status|state|activate|deactivate|pending|approved|rejected|draft|completed)\b/i],
  ['Notifications',/\b(notif\w*|email|SMS|push alert)\b/i],
  ['Document generation',/\b(generate|export|download|print)\b.*\b(document|report|PDF|certificate|file)\b/i],
  ['Approvals',/\b(approv\w*|authoriz\w*|sign-off|signoff)\b/i],
  ['Manual activities',/\b(user|admin|administrator|employee|manager|operator)\b.*\b(enter|select|configure|submit|review|click|input)\w*\b/i],
  ['System activities',/\b(system|application)\b.*\b(calculate|store|display|compare|assign|validate|generate|trigger|determine|merge)\w*\b/i],
 ];
 const areas=definitions.map(([name,pattern])=>{const matches=requirements.filter(r=>pattern.test(r.text+' '+r.reference));return {name,status:matches.length?'Found' as const:'Not stated' as const,items:matches.map(evidence)};});
 const actorArea=areas[0] as ProcessArea;actorArea.values=[...new Set(requirements.flatMap(r=>r.text.match(/\b(?:admin|administrator|employees?|managers?|supervisors?|approvers?|reviewers?|customers?|operators?|HR|applicants?|users?(?!-friendly))\b/gi)||[]).map(role=>role.toLowerCase()))];
 const scenarios:BusinessScenario[]=[],groups=new Map<string,BusinessScenario>();
 for(const r of requirements){
  const path=r.reference.replace(/^Page \d+\s*\|\s*/i,'').replace(/(?::\s*)?Line\s+\d.*$/i,'').split('\\');
  const section=path.findIndex(p=>/\b(requirements|acceptance criteria|input|process|output|validation|business rule)\b/i.test(p));
  const feature=(section>0?path.slice(0,section):path).filter(p=>p&&!/^\d+[.)]?$/.test(p)&&!/^Requirements$/i.test(p)&&!/^(?:FR|REQ|BR|NFR)[_-]\d+$/i.test(p)).join('\\');
  const subject=/\b(NID|profile|rating|score|permission|request|payment|report|email|tax|registration|account|document)\b/i.exec(r.text)?.[0].toLowerCase()||'business activity';
  const fieldDefinition=/\b(include|contain|display)\b.*\b(field|column)\b/i.test(r.text);
  const calculation=!fieldDefinition&&(/\b(?:system|application)\b.*\b(calculate|compare|determine|assign)\w*\b/i.test(r.text)&&/\b(rating|score|formula|calculation)\b/i.test(r.text)||/\bcalculation\b/i.test(r.text));
  const key=(feature||subject)+'|'+(calculation?'calculation':'activity');
  let scenario=groups.get(key);
  if(!scenario){
   const featureName=feature.split('\\').at(-1)?.replace(/^\d+(?:\.\d+)*[.)]?\s+/,'').replace(/\s+Setup$/i,'').trim();
   const title=calculation?(/value/i.test(featureName||'')?'Calculate and assign value ratings':'Calculate and assign performance ratings'):/rating|score/i.test(feature+' '+subject)?'Configure '+(featureName||'rating and score rules'):/NID|profile/i.test(feature+' '+subject)?'Manage profile identification':/approv/i.test(r.text)?'Review and decide the request':'Complete '+subject+' workflow';
   scenario={title,requirementIds:[],activities:[],decisions:[],alternateFlows:[],exceptionFlows:[],reviewPoints:[]};groups.set(key,scenario);scenarios.push(scenario);
  }
  scenario.requirementIds.push(r.id);scenario.activities.push(evidence(r));
  if(/\b(if|when|unless|otherwise|greater|less|within|exceed|equal|between)\b/i.test(r.text))scenario.decisions.push(evidence(r));
  if(/\b(otherwise|else|optional|cancel|rejoin|inactive|override)\b/i.test(r.text))scenario.alternateFlows.push(evidence(r));
  if(/\b(error|fail(?:s|ed|ure|ures)?|exception|timeout|unavailable|retry|rollback)\b/i.test(r.text))scenario.exceptionFlows.push(evidence(r));
 }
 const improvements:ProcessReview['improvements']=[];
 for(const scenario of scenarios){
  const combined=scenario.activities.map(a=>a.text).join(' '),references=scenario.activities.map(a=>a.reference);
  if(/\bexisting\b.*\b(rule|rules|validation|checks|behavior)\b/i.test(combined))improvements.push({topic:'Existing behavior',question:'During impact review, identify the existing rules that must stay unchanged and link the regression checks to them.',references});
  if(/\b(range|Min Score|Max Score)\b/i.test(combined)){
   scenario.reviewPoints.push('Check values below, at and above each configured limit, including equal endpoints and gaps between ranges.');
   if(!/\boverlap/i.test(combined))improvements.push({topic:'Range validation',question:'Should score ranges be allowed to overlap? Confirm the rule and what users should see if ranges overlap.',references});
  }
  if(/\b(calculat\w*|formula|average|total)\b/i.test(combined)){
   scenario.reviewPoints.push('Check decimal values, rounding, zero values and missing inputs against the approved calculation rule.');
   if(!/\b(formula|sum|average|multiply|divide|percentage)\b|[=+*/]/i.test(combined))improvements.push({topic:'Calculation rule',question:'Where is the calculation defined? Check the full document for its formula and inputs before deciding whether details are missing.',references});
  }
  if(/\b(duplicate|unique|NID)\b/i.test(combined))scenario.reviewPoints.push('Check duplicate matching, self-matches, inactive records and simultaneous submissions where they apply.');
  if(/\b(save|submit|update|store|creat\w*)\b/i.test(combined))scenario.reviewPoints.push('Check what happens if saving fails, the user submits twice or another user changes the same record.');
 }
 const coverage=[
  {area:'Business rules',status:requirements.some(r=>/business rule|validation/i.test(r.reference))?'Text available':'Not separately identified',explanation:'Compare the rules with the decisions and alternate flows listed above. A missing heading alone is not a requirement gap.'},
  {area:'UI mockups',status:/mockup|wireframe|screenshot|screen design/i.test(documentText)?'Manual visual review needed':'No separate mockup identified',explanation:'Text extraction cannot verify image-only mockups. Compare field labels, required marks, controls, messages and states with the original screens.'},
  {area:'Acceptance criteria',status:requirements.some(r=>/acceptance criteria/i.test(r.reference))?'Applicable text available':'No applicable criteria identified',explanation:'Items marked N/A are excluded. Do not report them as missing requirements.'},
 ];
 return {areas,scenarios,improvements,coverage,limitations:[
  'This offline review groups and checks the extracted text. It cannot establish that every business corner case has been covered.',
  '“Not stated” means no supporting text was found for that process area. It does not automatically mean a requirement is missing.',
  'Use the source references to verify suggestions. Quality and security review support traceability and controlled changes; this output does not certify CMMI or ISO compliance.',
 ]};
}

export function validateProcessReview(value:any){
 if(!value||!Array.isArray(value.areas)||value.areas.length!==14||!Array.isArray(value.scenarios)||value.scenarios.length>500||!Array.isArray(value.improvements)||!Array.isArray(value.coverage)||!Array.isArray(value.limitations)||JSON.stringify(value).length>1500000)throw new Error('Invalid business process review.');
 const string=(v:any)=>typeof v==='string'&&v.length<=20000;
 const evidence=(v:any)=>v&&string(v.text)&&string(v.reference)&&string(v.requirementId);
 for(const area of value.areas)if(!string(area.name)||!['Found','Not stated'].includes(area.status)||!Array.isArray(area.items)||!area.items.every(evidence)||(area.values!==undefined&&(!Array.isArray(area.values)||!area.values.every(string))))throw new Error('Invalid process evidence.');
 for(const scenario of value.scenarios)if(!string(scenario.title)||!Array.isArray(scenario.requirementIds)||!scenario.requirementIds.every(string)||!['activities','decisions','alternateFlows','exceptionFlows'].every(k=>Array.isArray(scenario[k])&&scenario[k].every(evidence))||!Array.isArray(scenario.reviewPoints)||!scenario.reviewPoints.every(string))throw new Error('Invalid business scenario.');
 for(const item of value.improvements)if(!string(item.topic)||!string(item.question)||!Array.isArray(item.references)||!item.references.every(string))throw new Error('Invalid improvement suggestion.');
 for(const item of value.coverage)if(!string(item.area)||!string(item.status)||!string(item.explanation))throw new Error('Invalid review coverage.');
 if(!value.limitations.every(string))throw new Error('Invalid review limitations.');
}
