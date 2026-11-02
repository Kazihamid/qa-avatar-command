import type {Case} from './model';
const moduleFailure=(error:unknown)=>error instanceof Error&&/dynamically imported module|module script failed|failed to fetch.*module|unable to preload (?:css|module)|loading chunk [\w-]+ failed/i.test(error.message);
type Dependencies={fetch:typeof fetch;importModule:(url:string)=>Promise<unknown>;origin:string};
export async function currentFeatureModule(name:string,dependencies?:Dependencies):Promise<unknown>{
 const origin=dependencies?.origin||window.location.origin;
 const response=await (dependencies?.fetch||fetch)(new URL('/asset-manifest.json',origin),{cache:'no-store',credentials:'same-origin'});
 if(response.status===401||response.headers.get('content-type')?.includes('text/html'))throw new Error('Your sign-in session has expired. Sign in again in another tab, then retry this action.');
 if(!response.ok)throw new Error('Could not load the updated app. Check your connection and retry, or reload the page.');
 const manifest=await response.json(),file=manifest[name]?.file;
 if(typeof file!=='string'||!/^assets\/[a-zA-Z0-9_./-]+\.js$/.test(file)||file.includes('..'))throw new Error('An app update is available. Reload the page and select your document again.');
 const url=new URL(file,origin);url.searchParams.set('feature-retry',String(Date.now()));
 return dependencies?dependencies.importModule(url.href):import(/* @vite-ignore */ url.href);
}
export async function runFeature<M,T>(name:string,load:()=>Promise<M>,run:(module:M)=>Promise<T>,recover:(name:string)=>Promise<unknown>=currentFeatureModule):Promise<T>{
 try{return await run(await load());}
 catch(error){if(!moduleFailure(error))throw error;}
 let latest:M;
 try{latest=await recover(name) as M;}
 catch(error){if(moduleFailure(error))throw new Error('The app could not load this feature. Check your connection or reload the page, then retry.');throw error;}
 try{return await run(latest);}
 catch(error){if(moduleFailure(error))throw new Error('The app could not load this feature. Check your connection or reload the page, then retry.');throw error;}
}
export function extractRequirementsDocument(file:File){return runFeature('lib/extract-document.ts',()=>import('./extract-document'),module=>module.extractDocument(file));}
export function downloadTestCases(cases:Case[],projectName:string){return runFeature('lib/export-test-cases.ts',()=>import('./export-test-cases'),module=>module.exportTestCases(cases,projectName));}
