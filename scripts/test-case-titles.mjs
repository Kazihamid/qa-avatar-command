import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const compile=path=>ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const moduleUrl=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const processUrl=moduleUrl(compile('../lib/process-analysis.ts'));
const titleUrl=moduleUrl(compile('../lib/case-title.ts'));
const {actionTitle,actionExample,capitalizeRequirement}=await import(titleUrl);
const {analyzeRequirements}=await import(moduleUrl(compile('../lib/document-analysis.ts').replace("'./process-analysis'",JSON.stringify(processUrl)).replace("'./case-title'",JSON.stringify(titleUrl))));

assert.equal(actionTitle('Consolidated NID'),'Test Consolidated NID');
assert.equal(actionTitle('REQ-001 · Reject nonnumeric input'),'Reject nonnumeric input');
assert.equal(actionTitle('validate mandatory NID'),'Validate mandatory NID');
assert.equal(actionTitle('To verify duplicate handling'),'Verify duplicate handling');
assert.equal(actionTitle('Delete an existing record'),'Delete an existing record');
assert.equal(capitalizeRequirement('an interim control, PMU Admin will be trained.'),'An interim control, PMU Admin will be trained.');
assert.equal(capitalizeRequirement('  “the NID field”'),'  “The NID field”');
assert.equal(capitalizeRequirement(''),'');
assert.equal(capitalizeRequirement('PMU Admin must save the NID.'),'PMU Admin must save the NID.');
assert.equal(analyzeRequirements('Requirements\nan interim control, PMU Admin will be trained to configure score ranges.','Ratings.pdf').requirements[0].statement,'An interim control, PMU Admin will be trained to configure score ranges.');
const exclusions=analyzeRequirements(['Requirements','The system must save the rating.','1.1.12. Exception: N/A','1.2.12. Exception: N / A.','Acceptance Criteria: Not applicable','Validation – N/A','Exception:','N/A','The system must show N/A when no rating exists.','The system must show an error message and retain data when an exception occurs.'].join('\n'),'Ratings.pdf');
assert.equal(exclusions.requirements.length,3);
assert.deepEqual(exclusions.gaps,[]);
assert.deepEqual(exclusions.gapDetails,[]);
assert.ok(exclusions.requirements.some(r=>r.statement.includes('show N/A')));
const ratingExample='Example: If the Final Values Rating is 12 and Interim value is 11, the system must use 11.5 without rounding and assign score of C as final value rating score, as it falls within the 8.00 – 11.99 range.';
const ratingAction=actionExample(ratingExample);
assert.equal(ratingAction,'Use 11.5 without rounding and assign score of C as final value rating score, as it falls within the 8.00 – 11.99 range when the Final Values Rating is 12 and Interim value is 11.');
assert.match(actionTitle(ratingExample),/^Use /);
assert.ok(!actionTitle(ratingExample).includes('Example'));
assert.equal(analyzeRequirements('Requirements\n'+ratingExample,'Ratings.pdf').requirements[0].statement,ratingAction);
assert.ok(actionTitle('A'.repeat(300),150).length<=150);

const analysis=analyzeRequirements([
 'Test Title CR_Duplicate NID Allow During Profile Creation',
 'Description',
 'Providing an auditable override path for inactive records.',
 'Requirements',
 'The system must require numeric NID input with a maximum length of 17 digits.',
 'The system must display the response quickly.',
 'The system must display an error when the lookup is unavailable.',
 'The system must allow profile creation.',
 'The system must not allow profile creation.'
].join('\n'),'CR.pdf');
assert.equal(analysis.cases.length,0);
assert.equal(analysis.requirements.length,5);
assert.ok(analysis.gaps.some(g=>g.includes('How quickly should this happen?')));
assert.ok(analysis.gaps.some(g=>g.includes('how the user can try again')));
assert.ok(analysis.gaps.some(g=>g.includes('disagree:')));
assert.ok(!analysis.requirements.some(r=>r.statement.includes('Test Title')||r.statement.includes('auditable')));
assert.throws(()=>analyzeRequirements('Test Title CR_Duplicate NID Allow During Profile Creation\nDescription\nProviding an auditable override path for inactive records.','CR.pdf'),/No explicit requirements/);
assert.equal(actionTitle('The system must display matching NID details when a duplicate is entered.'),'Display matching NID details');
assert.ok(actionTitle('Display '+Array(30).fill('details').join(' ')).length<=90);
console.log('Requirement analysis checks passed: zero generated cases, contextual text excluded, ambiguity, conflict and incomplete behavior identified.');
const reviewModule=compile('../lib/requirement-review.ts').replace("'./process-analysis'",JSON.stringify(processUrl)).replace("'./case-title'",JSON.stringify(titleUrl));
const {writeReviewedTestCases,validateRequirementReview,requirementCaseSignature,hasWrittenRequirementCases}=await import(moduleUrl(reviewModule));
const review={documentId:'doc-1',documentName:'CR.pdf',mode:'rules',summary:'Reviewed',gaps:[],requirements:analysis.requirements.map((r,index)=>({...r,included:index===0})),finalized:false};
assert.throws(()=>writeReviewedTestCases(review),/Finalize/);
validateRequirementReview(review);
const final={...review,finalized:true};
const written={...final,testCasesWrittenFor:requirementCaseSignature(final)};
assert.equal(hasWrittenRequirementCases(JSON.parse(JSON.stringify(written)),[]),true);
assert.equal(hasWrittenRequirementCases({...written,finalized:false},[]),true);
assert.equal(hasWrittenRequirementCases({...written,requirements:[...written.requirements,{id:'new',statement:'Display the rating.',source:'User',included:true}]},[]),false);
assert.equal(hasWrittenRequirementCases({...written,requirements:written.requirements.map(r=>({...r,statement:r.statement+' Changed.'}))},[]),false);
assert.equal(hasWrittenRequirementCases(final,writeReviewedTestCases(final)),true);
const cases=writeReviewedTestCases(final);
assert.ok(cases.length>=5);
assert.ok(cases.every(c=>c.requirementIds.length===1&&c.requirementIds[0]===analysis.requirements[0].reference));
assert.ok(cases.every(c=>c.title&&c.preconditions&&c.testData&&c.steps&&c.expected&&c.actual===''));
assert.ok(cases.every(c=>c.title.length<=90&&c.title.split(/\s+/).length<=12));
assert.ok(cases.some(c=>c.source.endsWith('/ positive')));
assert.ok(cases.some(c=>c.source.endsWith('/ negative')));
assert.equal(cases.filter(c=>c.source.endsWith('/ boundary')).length,3);
assert.ok(!cases.some(c=>c.source.includes(analysis.requirements[1].reference)));
assert.throws(()=>validateRequirementReview({...final,requirements:final.requirements.map(r=>({...r,included:false}))}),/Select at least one/);
const duplicate={...final,requirements:[final.requirements[0],{...final.requirements[0],id:'REQ-099'}]};
assert.equal(writeReviewedTestCases(duplicate).length,cases.length);
const prohibition={...final,requirements:[{id:'REQ-P',statement:'The system must not allow profile creation.',source:'CR.pdf line 4',included:true}]};
assert.equal(writeReviewedTestCases(prohibition).length,1);
console.log('Finalized requirement generation checks passed: explicit gate, selected-only traceability, detailed tests, boundaries and duplicate suppression.');

const plain=analyzeRequirements([
 'The system must apply existing NID validation rules.',
 'The system must enforce a maximum length.',
 'The system must display the existing employee record.',
 'The system must apply business rule #5.',
 '5. The system must reject letters in the NID field.'
].join('\n'),'CR.pdf');
assert.ok(!plain.gaps.some(g=>g.startsWith('Line 1:')));
assert.ok(plain.processReview.improvements.some(item=>item.topic==='Existing behavior'));
assert.ok(plain.gaps.some(g=>g.includes('Line 2: What is the allowed limit?')));
assert.ok(!plain.gaps.some(g=>g.startsWith('Line 3:')));
assert.ok(!plain.gaps.some(g=>g.startsWith('Line 4:')));
assert.ok(plain.gaps.every(g=>!/(Incomplete dependency|applicable behavior|baseline|Only identifiable requirements|Only the first)/.test(g)));
assert.ok(cases.every(c=>!/(applicable setup|data satisfying|governed by|Inspect the validation outcome|boundary value under)/.test([c.preconditions,c.testData,c.steps,c.expected].join(' '))));
console.log('Plain language checks passed: specific clarification questions, relevant quoted wording and no generic dependency warnings.');

const numbered=analyzeRequirements([
 '[Page 4]',
 '3.2 Business Rules',
 'FR-017: The system must apply existing NID validation rules.',
 '1. The system must display the response quickly.',
 'The system must enforce a maximum length.',
 '3.3 Other Rules',
 'The system must allow profile creation.',
 '[Page 5]',
 'Requirements',
 'The system must display the employee profile.',
 'BR_003: The system must reject duplicate NID values.'
].join('\n'),'CR.pdf');
assert.deepEqual(numbered.requirements.map(r=>r.reference),['Page 4 | 3.2 Business Rules\\FR-017: Line 3','Page 4 | 3.2 Business Rules\\1: Line 4','Page 4 | 3.2 Business Rules: Line 5','Page 4 | 3.3 Other Rules: Line 7','Page 5 | Requirements: Line 10','Page 5 | Requirements\\BR_003: Line 11']);
assert.ok(!numbered.gaps.some(g=>g.startsWith('Page 4 | 3.2 Business Rules\\FR-017: Line 3:')));
assert.ok(numbered.gaps.some(g=>g.startsWith('Page 4 | 3.2 Business Rules\\1: Line 4:')));
assert.ok(numbered.gaps.some(g=>g.startsWith('Page 4 | 3.2 Business Rules: Line 5:')));
assert.ok(numbered.requirements[0].source.includes('3.2 Business Rules'));
assert.ok(!numbered.gaps.some(g=>/REQ-\d{3}/.test(g)));
const numberedReview={...final,requirements:numbered.requirements.map(r=>({...r,included:r.reference.includes('FR-017')}))};
assert.ok(writeReviewedTestCases(numberedReview).every(c=>c.requirementIds.some(ref=>ref.includes('FR-017'))));
console.log('Document numbering checks passed: printed requirement IDs and heading numbers are preserved; unnumbered text uses page and line references.');

const reconstructed=analyzeRequirements([
 '[Page 9]',
 'Two optional NID fields will be',
 'merged into one mandatory field',
 '1. User will input numeric digits in the National ID field. National ID (Previous), National ID (Smart) fields will no longer be shown to users.',
 'must not be disclosed to any third party without prior written consent from BRAC IT. All rights to this document',
 'and the information'
].join('\n'),'CR.pdf');
assert.equal(reconstructed.requirements.length,2);
assert.equal(reconstructed.requirements[0].statement,'The system must merge the National ID (Previous) and National ID (Smart) fields into one mandatory field.');
assert.ok(reconstructed.requirements[0].source.includes('Line 2–3'));
assert.ok(reconstructed.requirements[1].statement.startsWith('Users must enter numbers in the National ID field.'));
assert.ok(!reconstructed.requirements.some(r=>/^\d+[.)]/.test(r.statement)));
assert.ok(!reconstructed.requirements.some(r=>/disclosed|BRAC IT/.test(r.statement)));
const incomplete=analyzeRequirements('Two optional NID fields will be','CR.pdf');
assert.equal(incomplete.requirements.length,0);
assert.ok(incomplete.gaps.some(g=>g.includes('text stops')&&g.includes('rest of the rule')));
console.log('Requirement reconstruction checks passed: wrapped text becomes a complete requirement, legal notices are excluded and missing context is flagged.');

const structured=analyzeRequirements([
 '[Page 2]',
 '16-Feb-2026 1.0 MD. Asadullah-All-Mukib,',
 '[Page 6]',
 '1.1.7. Requirements:',
 '1. Input',
 'The Performance Rating Scale Setup shall contain the following fields:',
 '• Rating Title* – Existing field.',
 '• Min Score* – New field to define the minimum calculated rating value.',
 '• Max Score* – New field to define the maximum calculated rating value.',
 '2. Process',
 'The system shall store the configured score range.',
 '3. Output',
 'The Performance Rating Scale List shall display the following columns:',
 '• Min Score',
 '• Max Score',
 '4. Validation',
 '• Min Score shall not be greater than Max Score.',
 '• The configured score ranges shall not overlap.',
 '5. Business Rule',
 'INPUT:',
 'PROCESS:',
 'OUTPUT:',
 'BUSINESS RULES/ VALIDATIONS:',
 'Employee Info Section:',
 'Upon Saving, system will follow the existing business as such:',
 'Below are the different use cases:',
 'o Add color-coded job status:'
].join('\n'),'CR.pdf');
const comparison=structured.requirements.find(r=>r.statement==='Min Score must not exceed Max Score.');
assert.ok(comparison);
assert.equal(comparison.reference,'Page 6 | 1.1.7 Requirements'+String.fromCharCode(92)+'4. Validation: Line 17');
assert.ok(structured.requirements.some(r=>r.statement==='The Performance Rating Scale Setup must include a Min Score field to define the minimum calculated rating value.'));
assert.ok(structured.requirements.some(r=>r.statement==='The Performance Rating Scale List must display a Min Score column.'));
assert.ok(!structured.gaps.some(g=>/text stops|Asadullah|INPUT|PROCESS|OUTPUT|Upon Saving|Below are|color-coded/.test(g)));
assert.ok(!structured.requirements.some(r=>/Asadullah|16-Feb/.test(r.statement)));
console.log('Structured document checks passed: page/heading/subheading/line paths, complete field requirements and no false gaps for metadata, headings or list introductions.');

const gapSource=analyzeRequirements([
 '[Page 7]',
 '1. Enhancement of Performance and Value Rating Setup',
 '1.1 Performance Rating Scale Setup',
 '1.1.9 Acceptance Criteria',
 'N/A',
 'The system shall display a response quickly.',
 'The system shall determine the Rating Title based on the applicable score range.',
 'This range-based logic must be used for Interim and Year-End ratings.',
 'Given an exact rating is available, when it falls within a configured Min Score – Max Score range, then the system must assign the corresponding Rating Title.'
].join('\n'),'CR.pdf');
assert.ok(!gapSource.gaps.some(g=>g.includes('N/A')||g.includes('allowed limit')));
assert.equal(gapSource.gapDetails.length,1);
const responseGap=gapSource.gapDetails.find(gap=>gap.originalText.includes('quickly'));
const criteriaGap=gapSource.gapDetails.find(gap=>gap.originalText==='N/A');
assert.equal(criteriaGap,undefined);
assert.equal(responseGap.originalText,'The system shall display a response quickly.');
assert.ok(responseGap.question.startsWith('How quickly should this happen?'));
assert.ok(!responseGap.question.includes('Requirement:'));
assert.equal(responseGap.reference,'Page 7 | 1. Enhancement of Performance and Value Rating Setup'+String.fromCharCode(92)+'1.1 Performance Rating Scale Setup'+String.fromCharCode(92)+'1.1.9 Acceptance Criteria: Line 6');
const {requirementReviewTitle}=await import(moduleUrl(compile('../lib/requirement-reference.ts')));
assert.equal(requirementReviewTitle('Page 6 | 1. Enhancement'+String.fromCharCode(92)+'1.1 Setup'+String.fromCharCode(92)+'1.1.7 Requirements'+String.fromCharCode(92)+'4. Validation: Line 17'),'Page 6, Line 17 | Requirements no. 1.1.7 '+String.fromCharCode(92)+'4. Validation');
assert.equal(requirementReviewTitle('Page 1 | Line 4'),'Page 1, Line 4 | No requirement number in the document');
assert.equal(requirementReviewTitle('Line 4'),'Line 4 | No requirement number in the document');
console.log('Gap display checks passed: original document text, separate clarification, checklist titles, no N/A warnings and no invented score limits.');

const processDocument=analyzeRequirements([
 '[Page 6]',
 '1. Enhancement of Performance and Value Rating Setup',
 '1.1 Performance Rating Scale Setup',
 '1.1.7 Requirements',
 '1. Input',
 'Admin must configure the Min Score and Max Score fields.',
 'The system must store the configured score range.',
 'The system must reject overlapping score ranges.',
 '2. Process',
 'The system must calculate the rating using the average score.',
 'When the calculation fails, the system must retain the entered values.',
 'If an override is approved, the system must record the approval.',
 '1.1.9 Acceptance Criteria',
 'N/A',
 '2. CR Accumulation',
 'Note: Effort given in the Regular type of CR Category will be included in AMC as per'
].join('\n'),'CR.pdf');
assert.ok(!processDocument.gaps.some(g=>/N\/A|AMC|Effort given/.test(g)));
assert.ok(!processDocument.requirements.some(r=>/AMC|Effort given/.test(r.statement)));
assert.equal(processDocument.processReview.areas.length,14);
assert.ok(processDocument.processReview.areas.find(area=>area.name==='Business actors').values.includes('admin'));
assert.equal(processDocument.processReview.areas.find(area=>area.name==='Integrations').status,'Not stated');
const groupedIds=processDocument.processReview.scenarios.flatMap(s=>s.requirementIds);
assert.equal(new Set(groupedIds).size,processDocument.requirements.length);
assert.equal(groupedIds.length,processDocument.requirements.length);
assert.ok(processDocument.processReview.scenarios.length<processDocument.requirements.length);
assert.ok(processDocument.processReview.scenarios.some(s=>s.exceptionFlows.length>0));
assert.ok(processDocument.processReview.scenarios.some(s=>s.decisions.length>0));
assert.ok(processDocument.processReview.scenarios.some(s=>s.alternateFlows.length>0));
assert.ok(processDocument.processReview.coverage.find(item=>item.area==='UI mockups').explanation.includes('image-only'));
assert.deepEqual(processDocument.cases,[]);
const {validateProcessReview}=await import(processUrl);validateProcessReview(processDocument.processReview);
const fullReview=analyzeRequirements(Array.from({length:80},(_,index)=>'The system must store field '+index+'.').join('\n'),'SRS.txt');
assert.equal(fullReview.requirements.length,80);assert.equal(fullReview.partial,false);
assert.equal(new Set(fullReview.processReview.scenarios.flatMap(s=>s.requirementIds)).size,80);
assert.throws(()=>validateProcessReview({}),/Invalid business process/);
console.log('Business process checks passed: 14 process areas, grouped complete activities, retained alternate/exception evidence, all requirements covered and no gaps for N/A or document administration.');
