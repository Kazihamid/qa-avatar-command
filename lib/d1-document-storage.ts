import {db} from './db';
// Optional cloud storage adapter: D1 Free stops at its limits instead of billing overages.
export function d1DocumentBucket():R2Bucket {
 return {
  async put(key,bytes){
   const database=db();const usage=await database.prepare('SELECT COALESCE(SUM(length(bytes)),0) AS n FROM qa_document_chunks').first<{n:number}>();
   if((usage?.n||0)+bytes.byteLength>100*1024*1024)throw new Error('Cloud document storage limit reached (100 MB).');
   try{for(let offset=0,index=0;offset<bytes.length;offset+=512*1024,index++)await database.prepare('INSERT INTO qa_document_chunks (object_key,chunk_index,bytes) VALUES (?,?,?)').bind(key,index,bytes.slice(offset,offset+512*1024).buffer).run();}
   catch(error){await database.prepare('DELETE FROM qa_document_chunks WHERE object_key=?').bind(key).run();throw error;}
  },
  async get(key){
   const rows=await db().prepare('SELECT bytes FROM qa_document_chunks WHERE object_key=? ORDER BY chunk_index').bind(key).all<{bytes:number[]}>();
   if(!rows.results.length)return null;
   return {body:new Blob(rows.results.map(row=>new Uint8Array(row.bytes))).stream()};
  },
  async delete(key){await db().prepare('DELETE FROM qa_document_chunks WHERE object_key=?').bind(key).run();}
 };
}
