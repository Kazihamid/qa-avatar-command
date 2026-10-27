// Local stand-in for Cloudflare D1, backed by Node's built-in SQLite (node:sqlite).
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readdirSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';

export const dataDir=resolve(process.env.QA_DATA_DIR||'data');
let handle:DatabaseSync|undefined;

function open():DatabaseSync{
 if(handle)return handle;
 mkdirSync(dataDir,{recursive:true});
 const h=new DatabaseSync(join(dataDir,'qa.sqlite'));
 h.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS __migrations (name TEXT PRIMARY KEY)');
 // Apply the same SQL migrations the hosted version used, once each, in order.
 const dir=resolve(process.env.QA_MIGRATIONS_DIR||'drizzle');
 const applied=new Set((h.prepare('SELECT name FROM __migrations').all() as {name:string}[]).map(r=>r.name));
 for(const file of readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()){
  if(applied.has(file))continue;
  for(const statement of readFileSync(join(dir,file),'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))h.exec(statement);
  h.prepare('INSERT INTO __migrations (name) VALUES (?)').run(file);
 }
 return handle=h;
}

class Statement{
 constructor(private sql:string,private args:unknown[]=[]){}
 bind(...args:unknown[]){return new Statement(this.sql,args);}
 async first<T>():Promise<T|null>{return (open().prepare(this.sql).get(...(this.args as never[])) as T|undefined)??null;}
 async all<T>():Promise<{results:T[]}>{return {results:open().prepare(this.sql).all(...(this.args as never[])) as T[]};}
 async run():Promise<{meta:{changes:number}}>{const r=open().prepare(this.sql).run(...(this.args as never[]));return {meta:{changes:Number(r.changes)}};}
}
export const d1={prepare:(sql:string)=>new Statement(sql)};
