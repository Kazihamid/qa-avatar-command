/** Format a checklist label without inventing a document requirement number. */
export function requirementReviewTitle(reference:string):string {
 const page=reference.match(/Page\s+(\d+)/i)?.[1];
 const line=reference.match(/Line\s+(\d+(?:[–-]\d+)?)/i)?.[1];
 let path=reference.replace(/^Page\s+\d+\s*\|\s*/i,'').replace(/:?\s*Line\s+\d+(?:[–-]\d+)?\s*$/i,'').trim();
 const sections=path.split('\\').filter(Boolean);
 const requirementSection=sections.findIndex(section=>/^\d+(?:\.\d+)*\.?\s+Requirements\b/i.test(section));
 if(requirementSection>=0){
  const selected=sections.slice(requirementSection);
  selected[0]=selected[0].replace(/\.?\s+Requirements\b/i,'').trim();
  path=selected.join(' \\');
 }
 else if(!sections.some(section=>/^(?:\d|(?:FR|BR|REQ|NFR)[-_])/i.test(section)))path='';
 const location=[page?'Page '+page:'',line?'Line '+line:''].filter(Boolean).join(', ');
 return (location||reference)+(path?' | Requirements no. '+path:' | No requirement number in the document');
}
