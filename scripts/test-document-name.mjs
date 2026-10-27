import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../lib/requirement-document-name.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {requirementDocumentName}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
assert.equal(requirementDocumentName('CR-HRMSV2-1263: Duplicate NID','original-long-name.PDF'),'CR-HRMSV2-1263.pdf');
assert.equal(requirementDocumentName('SRS | HRMSV2-1263 | Duplicate NID','original.docx'),'SRS-HRMSV2-1263.docx');
assert.equal(requirementDocumentName('CR-HRMSV2-1263 Duplicate NID','original.md'),'CR-HRMSV2-1263.md');
assert.equal(requirementDocumentName('','original.txt'),'Requirements.txt');
assert.equal(requirementDocumentName('CR-HRMSV2-1263: Duplicate NID','another.txt'),'CR-HRMSV2-1263.txt');
assert.ok(!requirementDocumentName('../CR/HRMSV2-1263','original.pdf').includes('/'));
console.log('Requirements document code checks passed: assignment references, descriptions, extensions and safe filenames.');
