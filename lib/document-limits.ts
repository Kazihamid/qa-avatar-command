export const MAX_DOCUMENT_CHARACTERS=2_000_000;
export const MAX_DOCUMENT_UPLOAD_BYTES=24*1024*1024;
export const DOCUMENT_TEXT_CHUNK_CHARACTERS=128_000;
export function documentTextChunks(text:string):string[]{
 const chunks:string[]=[];
 for(let start=0;start<text.length;){let end=Math.min(start+DOCUMENT_TEXT_CHUNK_CHARACTERS,text.length);if(end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1])&&/[\uDC00-\uDFFF]/.test(text[end]))end--;chunks.push(text.slice(start,end));start=end;}
 return chunks;
}
