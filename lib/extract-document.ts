import {validateUpload} from './document-analysis';
export async function extractDocument(file:File):Promise<{text:string;warnings:string[]}>{
 const buffer=await file.arrayBuffer(),bytes=new Uint8Array(buffer);const {extension}=validateUpload(file.name,file.size,bytes);let text='',warnings:string[]=[];
 if(extension==='pdf'){
  const pdfjs=await import('pdfjs-dist/build/pdf.mjs');const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
  const task=pdfjs.getDocument({data:bytes});let pdf;
  try{pdf=await task.promise;if(pdf.numPages>100)throw new Error('PDF exceeds 100 pages. Split the source into smaller files.');let empty=0;for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const content=await page.getTextContent();let pageText='';for(const item of content.items){if('str' in item)pageText+=item.str+(item.hasEOL?'\n':' ')}if(pageText.trim().length<15)empty++;text+='[Page '+n+']\n'+pageText+'\n\n';if(text.length>200000)throw new Error('Extracted text exceeds 200,000 characters. Split the document.');page.cleanup();}if(empty)warnings.push(empty+' page(s) have little or no selectable text. Scans and image-only requirements may need OCR.');warnings.push('Review tables, reading order and diagrams against the original PDF.');}
  catch(e){throw new Error((e as Error).name==='PasswordException'?'Password-protected PDF: upload an unlocked copy.':(e as Error).message||'Could not read PDF.');}finally{await task.destroy();}
 }else if(extension==='docx'){
  const module=await import('mammoth/mammoth.browser.js');const mammoth=module.default||module;const result=await mammoth.extractRawText({arrayBuffer:buffer});text=result.value;warnings=result.messages.filter((m:any)=>m.type==='warning').slice(0,10).map((m:any)=>String(m.message).slice(0,1000));warnings.push('DOCX text is extracted; diagrams and images require manual review.');
 }else{try{text=new TextDecoder('utf-8',{fatal:true}).decode(buffer)}catch{throw new Error('Text files must use UTF-8 encoding. Save as UTF-8 and retry.')}}
 if(text.length>200000)throw new Error('Extracted text exceeds 200,000 characters. Split the document.');if(!text.trim()||!text.replace(/\[Page \d+\]/g,'').trim())warnings.push('No readable text found. Upload a text-based copy or paste OCR text.');return {text,warnings};
}
