import ExcelJS from 'exceljs';
import type {Case} from './model';

export async function createTestCaseWorkbook(cases:Case[]):Promise<Uint8Array> {
 const workbook=new ExcelJS.Workbook();
 workbook.creator='QA Avatar Command';
 const sheet=workbook.addWorksheet('Test Cases',{views:[{state:'frozen',ySplit:1}]});
 sheet.columns=[
  {header:'No.',key:'number',width:7},{header:'Case ID',key:'id',width:20},
  {header:'Requirement Reference',key:'reference',width:45},{header:'Test Scenario',key:'title',width:55},
  {header:'Preconditions',key:'preconditions',width:45},{header:'Test Data',key:'testData',width:40},
  {header:'Steps',key:'steps',width:60},{header:'Expected Result',key:'expected',width:55},
  {header:'Actual Result',key:'actual',width:45},{header:'Priority',key:'priority',width:14},
  {header:'Status',key:'status',width:22},{header:'Evidence',key:'evidence',width:40}
 ];
 cases.forEach((c,index)=>sheet.addRow({...c,number:index+1,reference:c.requirementIds?.join('\n')||c.source,preconditions:c.preconditions||'',testData:c.testData||''}));
 sheet.eachRow(row=>{row.alignment={vertical:'top',wrapText:true};});
 const header=sheet.getRow(1);header.height=26;
 header.eachCell(cell=>{cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1B4CC2'}};});
 sheet.autoFilter={from:'A1',to:'L'+Math.max(1,sheet.rowCount)};
 return new Uint8Array(await workbook.xlsx.writeBuffer());
}
export async function exportTestCases(cases:Case[],projectName:string):Promise<void> {
 const bytes=await createTestCaseWorkbook(cases);
 const blob=new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 const url=URL.createObjectURL(blob),anchor=document.createElement('a');
 anchor.href=url;anchor.download=(projectName.replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,100)||'QA-Avatar-Command')+'-Test-Cases.xlsx';
 document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
