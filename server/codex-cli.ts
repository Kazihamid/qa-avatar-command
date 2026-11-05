import {access,readdir,stat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {delimiter,join} from 'node:path';

export async function findCodex():Promise<string> {
 const candidates:string[]=[];
 if(process.env.QA_CODEX_COMMAND)candidates.push(process.env.QA_CODEX_COMMAND);
 for(const folder of (process.env.PATH||'').split(delimiter))if(folder)candidates.push(join(folder,process.platform==='win32'?'codex.exe':'codex'));
 if(process.platform==='win32'&&process.env.LOCALAPPDATA) {
  const root=join(process.env.LOCALAPPDATA,'OpenAI','Codex','bin');
  try {
   const folders=await readdir(root,{withFileTypes:true});
   const installed=await Promise.all(folders.filter(entry=>entry.isDirectory()).map(async entry=>({path:join(root,entry.name,'codex.exe'),modified:(await stat(join(root,entry.name))).mtimeMs})));
   candidates.push(...installed.sort((a,b)=>b.modified-a.modified).map(entry=>entry.path));
  }catch{}
 }
 for(const candidate of candidates)try{await access(candidate,constants.X_OK);return candidate;}catch{}
 throw new Error('Codex could not be located. Open the Codex desktop app or set QA_CODEX_COMMAND to the full executable path in .env.');
}
