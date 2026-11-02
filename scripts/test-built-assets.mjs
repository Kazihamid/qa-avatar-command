import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const root=path.resolve('dist/public'),manifest=JSON.parse(fs.readFileSync(path.join(root,'asset-manifest.json'),'utf8'));
for(const name of ['lib/extract-document.ts','lib/export-test-cases.ts']){
 assert.ok(manifest[name]?.isDynamicEntry,'Missing feature entry: '+name);
 const visited=new Set(),pending=[name];while(pending.length){const key=pending.pop();if(visited.has(key))continue;visited.add(key);assert.notEqual(key,'index.html','Feature recovery must not import or restart the main app');const entry=manifest[key];assert.ok(entry,'Missing asset entry: '+key);assert.ok(fs.existsSync(path.join(root,entry.file)));pending.push(...entry.imports||[],...entry.dynamicImports||[]);}
}
console.log('Built asset checks passed: upload and Excel export remain independently recoverable and all manifest files exist.');
