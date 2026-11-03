import type {Analysis} from './document-analysis';
export function analyzeInBrowser(text:string,filename:string):Promise<Analysis>{
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./requirement-analysis.worker.ts',import.meta.url),{type:'module'});
  const timer=setTimeout(()=>{worker.terminate();reject(new Error('Document analysis took too long. Please retry.'));},120000);
  const finish=()=>{clearTimeout(timer);worker.terminate();};
  worker.onmessage=(event:MessageEvent<{analysis?:Analysis;error?:string}>)=>{finish();if(event.data.error)reject(new Error(event.data.error));else if(event.data.analysis)resolve(event.data.analysis);else reject(new Error('The document review could not be read. Please retry.'));};
  worker.onerror=()=>{finish();reject(new Error('The analysis worker could not load.'));};
  worker.postMessage({text,filename});
 });
}
