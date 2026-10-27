import {env} from 'cloudflare:workers';
import {db} from './db';
export function bucket():R2Bucket{const b=(env as unknown as {BUCKET?:R2Bucket}).BUCKET;if(!b)throw new Error('Attachment storage is unavailable');return b;}
export async function hasProject(owner:string,projectId:string){const row=await db().prepare('SELECT data FROM qa_workspaces WHERE owner=?').bind(owner).first<{data:string}>();return !!row&&JSON.parse(row.data).projects.some((p:{id:string})=>p.id===projectId);}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin;}
export type DocumentRow={id:string;owner:string;project_id:string;name:string;mime:string;size:number;object_key:string;content:string;warnings:string;created_at:string};
export function metadata(r:DocumentRow){return {id:r.id,name:r.name,size:r.size,characters:r.content.length,warnings:JSON.parse(r.warnings),createdAt:r.created_at};}
