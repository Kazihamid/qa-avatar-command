/** Use the assignment's requirement type and Jira reference, excluding its description. */
export function requirementDocumentName(assignment:string,filename:string):string {
 const extension=filename.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase();
 const parts=assignment.split('|').map(part=>part.trim());
 const reference=(parts.length>1?parts.slice(0,2).join('-'):assignment).split(/[:：]/)[0].trim();
 const jiraReference=reference.match(/^(.+?-\d+)(?:\s|$)/)?.[1]||reference;
 const code=jiraReference.replace(/[^\p{L}\p{N}_-]+/gu,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,250)||'Requirements';
 return code+(extension?'.'+extension:'');
}
