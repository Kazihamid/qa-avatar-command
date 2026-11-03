import {documentTextChunks,DOCUMENT_TEXT_CHUNK_CHARACTERS} from './document-limits';
import {d1DocumentBucket} from './d1-document-storage';
import {env} from 'cloudflare:workers';
import {db} from './db';
export function bucket():R2Bucket{const b=(env as unknown as {BUCKET?:R2Bucket}).BUCKET;if(b)return b;if(env.DOCUMENT_STORAGE==='d1')return d1DocumentBucket();throw new Error('Attachment storage is unavailable');}
export async function hasProject(owner:string,projectId:string){const row=await db().prepare('SELECT data FROM qa_workspaces WHERE owner=?').bind(owner).first<{data:string}>();return !!row&&JSON.parse(row.data).projects.some((p:{id:string})=>p.id===projectId);}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin;}
export type DocumentRow={id:string;owner:string;project_id:string;name:string;mime:string;size:number;object_key:string;content:string;text_length?:number|null;warnings:string;created_at:string};
export function metadata(r:DocumentRow){return {id:r.id,name:r.name,size:r.size,characters:r.text_length??r.content.length,warnings:JSON.parse(r.warnings),createdAt:r.created_at};}

export async function storeDocumentText(id:string,text:string):Promise<{content:string;text_length:number}>{
 if(text.length<=DOCUMENT_TEXT_CHUNK_CHARACTERS)return {content:text,text_length:text.length};
 try{const chunks=documentTextChunks(text);for(let i=0;i<chunks.length;i++)await db().prepare('INSERT INTO qa_document_text_chunks (document_id,chunk_index,content) VALUES (?,?,?)').bind(id,i,chunks[i]).run();return {content:'',text_length:text.length};}
 catch(error){await deleteDocumentText(id);throw error;}
}
export async function deleteDocumentText(id:string){await db().prepare('DELETE FROM qa_document_text_chunks WHERE document_id=?').bind(id).run();}
export async function readDocumentText(row:DocumentRow):Promise<string>{
 if(row.content||!row.text_length)return row.content;
 const chunks=await db().prepare('SELECT content FROM qa_document_text_chunks WHERE document_id=? ORDER BY chunk_index').bind(row.id).all<{content:string}>();
 const text=chunks.results.map(chunk=>chunk.content).join('');if(text.length!==row.text_length)throw new Error('The full document text could not be loaded. Please retry.');return text;
}
