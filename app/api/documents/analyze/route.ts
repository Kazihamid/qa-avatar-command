import {getChatGPTUser} from '@/app/chatgpt-auth';
import {db} from '@/lib/db';
import {sameOrigin,type DocumentRow} from '@/lib/document-store';
import {aiAnalyze,aiConfigured} from '@/lib/ai-document-analysis';
import {analyzeRequirements} from '@/lib/document-analysis';
import {writeReviewedTestCases} from '@/lib/requirement-review';
import type {Workspace} from '@/lib/model';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in required'},{status:401});
 if(!sameOrigin(request))return Response.json({error:'Cross-origin write denied'},{status:403});
 try{
  const input=await request.json();
  const stored=await db().prepare('SELECT data FROM qa_workspaces WHERE owner=?').bind(user.userId).first<{data:string}>();
  const workspace:Workspace|undefined=stored?JSON.parse(stored.data):undefined;
  const project=workspace?.projects.find(p=>p.id===input.projectId);
  if(!project)return Response.json({error:'Project not found'},{status:404});
  if(input.action==='generate'){
   if(!project.requirementReview?.finalized)return Response.json({error:'Finalize the requirement list before writing test cases.'},{status:409});
   return Response.json({cases:writeReviewedTestCases(project.requirementReview),review:project.requirementReview});
  }
  let content=project.requirements,filename='Pasted requirements';
  if(input.id!=='pasted'){
   const row=await db().prepare('SELECT * FROM qa_documents WHERE id=? AND owner=?').bind(input.id,user.userId).first<DocumentRow>();
   if(!row||row.project_id!==project.id)return Response.json({error:'Attachment not found'},{status:404});
   content=row.content;filename=row.name+' [attachment '+row.id.slice(0,8)+']';
  }
  if(!content.replace(/\[Page \d+\]/g,'').trim())return Response.json({error:'No readable text found. Use a text-based document or paste requirements.'},{status:422});
  if(input.mode==='ai'){
   if(!aiConfigured())return Response.json({error:'Configure OPENAI_API_KEY to use AI review.'},{status:503});
   if(input.consent!==true)return Response.json({error:'Confirm sending extracted text for AI review.'},{status:400});
   return Response.json({analysis:await aiAnalyze(content,filename)});
  }
  return Response.json({analysis:analyzeRequirements(content,filename)});
 }catch(e){console.error(e);return Response.json({error:e instanceof Error?e.message:'Requirement review failed.'},{status:400});}
}
