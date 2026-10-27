// Local stand-in for Cloudflare R2: stores uploaded originals as plain files under data/files.
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {dirname,join,resolve,sep} from 'node:path';
import {dataDir} from './sqlite';

function pathFor(key:string){
 if(!/^[\w./-]+$/.test(key)||key.includes('..')||key.startsWith('/'))throw new Error('Invalid storage key');
 const root=resolve(join(dataDir,'files'));const full=resolve(join(root,key));
 if(!full.startsWith(root+sep))throw new Error('Invalid storage key');
 return full;
}
export const fileBucket={
 async put(key:string,bytes:Uint8Array,_options?:unknown){const p=pathFor(key);await mkdir(dirname(p),{recursive:true});await writeFile(p,bytes);},
 async get(key:string){try{const buf=await readFile(pathFor(key));return {body:new Blob([new Uint8Array(buf)]).stream()};}catch{return null;}},
 async delete(key:string){await rm(pathFor(key),{force:true});},
};
