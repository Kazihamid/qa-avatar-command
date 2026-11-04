/** Remove unmapped font glyphs that PDF extraction can leave in case text. */
export function cleanCaseText(value:string):string {
 if(!/[\p{Co}\uFFFD]/u.test(value))return value;
 return value.replace(/[\p{Co}\uFFFD]+/gu,' ').trim();
}
/** Capitalize the opening letter without changing field names or later text. */
export function capitalizeRequirement(value:string):string {
 return value.replace(/^(\s*[^\p{L}\p{N}]*)(\p{L})/u,(_match,prefix,letter)=>prefix+letter.toUpperCase());
}
/** Turn a source example into an action while retaining its inputs and outcome. */
export function actionExample(value:string):string {
 if(!/^\s*(?:for\s+)?example\s*[:–—-]\s*/i.test(value))return value;
 const text=value.replace(/^\s*(?:for\s+)?example\s*[:–—-]\s*/i,'').trim();
 const conditional=text.match(/^if\s+(.+?),\s*(?:then\s+)?(?:the\s+)?system\s+(?:must|shall|will|should)\s+(.+?)[.]?$/i);
 if(conditional){const action=conditional[2].replace(/[.]$/,'');return action.charAt(0).toUpperCase()+action.slice(1)+' when '+conditional[1].replace(/^The\b/,'the')+'.';}
 return 'Check that '+text.charAt(0).toLowerCase()+text.slice(1);
}
// Keep requirement references in source metadata so the title starts with its action.
export function actionTitle(value:string):string {
 value=actionExample(cleanCaseText(value));
 const stripNumber=(text:string)=>text.replace(/^(?:\d+(?:\.\d+)*[.)]?\s+|[-•]\s*)+/,'');
 let title=stripNumber(value.trim().replace(/^(?:(?:REQ|TC|CR|SRS)[-\s]?\d+(?:\.\d+)*\s*[·:.)-]\s*)+/i,'').replace(/^to\s+(?=verify\b|validate\b|check\b)/i,''))
  .replace(/^(verify|validate|check)\s+(\d+(?:\.\d+)*[.)]?\s+)/i,'$1 ')
  .replace(/^(?:(?:the\s+)?(?:system|application|user|users)\s+)?(?:must|shall|should|will)\s+(?:be\s+able\s+to\s+)?/i,'');
 // Keep the full rule for conditional restrictions and remove only redundant framing.
 const explicitCheck=/^Check that\s+/i.test(title);
 const mainAction=title.match(/^(?:if|when)\b.+?,\s*(?:then\s+)?(?:the\s+)?(?:system|application|users?)\s+(?:must|shall|should|will|can|may)\s+(.+)/i);
 if(mainAction&&!explicitCheck)title=mainAction[1];
 title=title.replace(/^(?:be\s+able\s+to\s+|(?:be\s+)?allowed\s+to\s+)/i,'')
  .replace(/^require\s+/i,'Validate ').replace(/\s*\((?:refer|see)\b[^)]*\)/gi,'')
  .replace(/\s+/g,' ').trim().replace(/[.;:]$/,'');
 // Drop an ordinary trailing condition only when the action already names what it acts on.
 const standalone=title.match(/^(.+?)\s+(?:when|if)\s+/i)?.[1];
 if(!explicitCheck&&standalone&&/\s/.test(standalone)&&!/\b(?:that|to|of|as|with|and|or|by|for|in|from|on|using|must|shall|will|should|be)\s*$/i.test(standalone))title=standalone;
 const action=/^(use|assign|verify|validate|check|inspect|ensure|confirm|test|reject|prevent|allow|block|display|show|hide|create|retrieve|determine|apply|map|include|preserve|keep|add|update|edit|delete|remove|save|submit|cancel|select|enter|upload|download|export|import|search|filter|sort|navigate|open|close|enable|disable|accept|deny|restrict|enforce|retain|clear|reset|calculate|compare|authenticate|authorize|log|record|send|receive|handle|detect|trigger|inspect|exercise|simulate|recover|retest)\b/i;
 const verb=/\b(numeric|required|mandatory|validat|duplicate|unique|business rule)/i.test(title)?'Validate':/\b(permission|access|role|restrict)/i.test(title)?'Check':/\b(display|visible|shown|message)/i.test(title)?'Inspect':/\b(save|persist|record|stored)/i.test(title)?'Confirm':'Test';
 const result=action.test(title)?title.charAt(0).toUpperCase()+title.slice(1):verb+' '+title;
 return result;
}
