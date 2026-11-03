import {analyzeRequirements} from './document-analysis';
self.onmessage=(event:MessageEvent<{text:string;filename:string}>)=>{
 try{self.postMessage({analysis:analyzeRequirements(event.data.text,event.data.filename)});}
 catch(error){self.postMessage({error:error instanceof Error?error.message:'Could not analyze the document.'});}
};
