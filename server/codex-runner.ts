import {chromium,expect,type Browser,type BrowserContext,type Locator,type Page} from 'playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {executionOrigin,type BrowserStep,type CodexBatch,type CodexPlan,type CodexResult} from '../lib/codex-execution';

export function findElement(context:Page,step:BrowserStep):Locator {
 switch(step.by) {
  case 'role':return context.getByRole(step.locator as Parameters<typeof context.getByRole>[0],{name:step.name||undefined,exact:true});
  case 'label':return context.getByLabel(step.locator,{exact:true});
  case 'text':return context.getByText(step.locator,{exact:true});
  case 'placeholder':return context.getByPlaceholder(step.locator,{exact:true});
  case 'testId':return context.getByTestId(step.locator);
  default:return context.locator(step.locator);
 }
}
export async function runBrowserCase(browser:Browser,batch:CodexBatch,plan:CodexPlan,directory:string,storageState?:string):Promise<CodexResult> {
 const c=batch.cases.find(c=>c.id===plan.caseId)!;
 const folder=resolve(directory,'case-'+(batch.cases.indexOf(c)+1));await mkdir(folder,{recursive:true});
 const result:CodexResult={id:c.id,fingerprint:c.fingerprint,status:'Blocked',actual:'The browser could not start.',evidence:folder,assertions:0};
 let context:BrowserContext|undefined,asserting=false,actionIndex=0,lastStep:BrowserStep|undefined;
 try {
  context=await browser.newContext({storageState,serviceWorkers:'block',acceptDownloads:false});
  await context.route('**/*',route=>{
   const request=route.request();
   if(request.isNavigationRequest()&&executionOrigin(request.url())!==executionOrigin(batch.environment))return route.abort();
   return route.continue();
  });
  await context.tracing.start({screenshots:true,snapshots:true,sources:false});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  await page.goto(batch.environment,{waitUntil:'domcontentloaded',timeout:20000});
  for(const step of plan.steps) {
   actionIndex++;asserting=false;lastStep=step;
   if(step.action==='navigate'){await page.goto(new URL(step.value,batch.environment).href,{waitUntil:'domcontentloaded',timeout:20000});continue;}
   const locator=findElement(page,step);
   switch(step.action) {
    case 'click':await locator.click();break;
    case 'fill':await locator.fill(step.value);break;
    case 'select':await locator.selectOption(step.value);break;
    case 'check':await locator.check();break;
    case 'uncheck':await locator.uncheck();break;
    case 'visible':asserting=true;await expect(locator).toBeVisible({timeout:10000});result.assertions++;break;
    case 'hidden':asserting=true;await expect(locator).toBeHidden({timeout:10000});result.assertions++;break;
    case 'text':asserting=true;await expect(locator).toHaveText(step.value,{timeout:10000});result.assertions++;break;
    case 'value':asserting=true;await expect(locator).toHaveValue(step.value,{timeout:10000});result.assertions++;break;
    case 'url':asserting=true;await expect(page).toHaveURL(new URL(step.value,batch.environment).href,{timeout:10000});result.assertions++;break;
    case 'count':asserting=true;await expect(locator).toHaveCount(Number(step.value),{timeout:10000});result.assertions++;break;
   }
  }
  result.status=result.assertions?'Pass':'Needs clarification';
  result.actual=result.assertions+' observable assertion(s) passed across '+actionIndex+' browser actions. Expected result: '+c.expected;
  await page.screenshot({path:join(folder,'result.png'),fullPage:true}).catch(()=>{});
 }catch(error) {
  result.status=asserting?'Fail':'Blocked';
  result.actual=asserting?'The expected result was not observed at browser action '+actionIndex+'. Review the local screenshot and trace.':'Browser setup or action '+actionIndex+' could not finish. Review the local evidence before retrying.';
  if(asserting&&lastStep&&context?.pages()[0]) {
   const page=context.pages()[0],locator=findElement(page,lastStep);
   try {
    const observed=lastStep.action==='url'?page.url():lastStep.action==='count'?String(await locator.count()):lastStep.action==='visible'||lastStep.action==='hidden'?String(await locator.isVisible()):lastStep.action==='value'?await locator.inputValue({timeout:1000}):(await locator.allTextContents()).join(' ');
    result.actual+=' Expected '+lastStep.action+' '+JSON.stringify(lastStep.value||lastStep.locator)+'. Observed '+JSON.stringify(observed.slice(0,1500))+'.';
   }catch{}
  }
  await writeFile(join(folder,'error.txt'),String(error),'utf8');
  await context?.pages()[0]?.screenshot({path:join(folder,'result.png'),fullPage:true}).catch(()=>{});
 }finally {
  await context?.tracing.stop({path:join(folder,'trace.zip')}).catch(()=>{});
  await context?.close();
  await writeFile(join(folder,'result.json'),JSON.stringify(result,null,2),'utf8');
 }
 return result;
}
export {chromium};
