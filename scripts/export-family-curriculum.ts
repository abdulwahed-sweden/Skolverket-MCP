/**
 * Export shared curriculum catalogs for the remaining children.
 *
 * Yara: grade 6 -> official stage 4-6 (HKK 1-6)
 * Omar: grade 9 -> official stage 7-9, plus a Swedish reinforcement-track profile
 * Esra: administrative placement in gymnasiet, but curriculum selected per subject;
 *       the grade-9 catalog is prepared as a recovery catalog without guessing active subjects.
 *
 * Svenska vs SVA is intentionally unresolved for Yara/Omar until school registration is confirmed.
 * Both official subjects are exported so the profile can switch by reference only.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const serverEntry = join(root, 'dist', 'index.js');

type Spec = { code:string; stage:string; grade:number };

const COMMON_CODES = [
  'GRGRSVE01','GRGRSVA01',
  'GRGRMAT01','GRGRENG01',
  'GRGRBIO01','GRGRFYS01','GRGRKEM01','GRGRTEK01',
  'GRGRGEO01','GRGRHIS01','GRGRREL01','GRGRSAM01',
  'GRGRBIL01','GRGRMUS01','GRGRSLJ01','GRGRIDR01','GRGRHKK01'
];

const GRADE6: Spec[] = COMMON_CODES.map(code => ({
  code,
  stage: code === 'GRGRHKK01' ? '1-6' : '4-6',
  grade: 6
}));

const GRADE9: Spec[] = COMMON_CODES.map(code => ({
  code,
  stage: '7-9',
  grade: 9
}));

function callTool(args:Record<string,unknown>):Promise<string>{
  return new Promise((resolve,reject)=>{
    const proc=spawn(process.execPath,[serverEntry],{
      stdio:['pipe','pipe','pipe'],
      env:{...process.env,LOG_LEVEL:'error'}
    });
    let buf='';
    const timer=setTimeout(()=>{proc.kill();reject(new Error('Timeout after 60s'));},60000);
    proc.stdout.on('data',chunk=>{
      buf+=chunk.toString();
      const lines=buf.split('\n');
      buf=lines.pop()??'';
      for(const line of lines){
        if(!line.trim()) continue;
        let msg:any;
        try{msg=JSON.parse(line);}catch{continue;}
        if(msg.id!==2) continue;
        clearTimeout(timer); proc.kill();
        if(msg.error) return reject(new Error(msg.error.message));
        if(msg.result?.isError) return reject(new Error(msg.result.content[0].text));
        return resolve(msg.result.content[0].text);
      }
    });
    proc.on('error',reject);
    proc.stdin.write(JSON.stringify({
      jsonrpc:'2.0',id:1,method:'initialize',
      params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'family-export',version:'1'}}
    })+'\n');
    setTimeout(()=>proc.stdin.write(JSON.stringify({
      jsonrpc:'2.0',id:2,method:'tools/call',
      params:{name:'get_tutor_teaching_context',arguments:args}
    })+'\n'),400);
  });
}

function writeJson(path:string,value:unknown){
  mkdirSync(dirname(path),{recursive:true});
  writeFileSync(path,JSON.stringify(value,null,2)+'\n','utf8');
}

function subjectReadme(d:any){
  const units=d.units.map((u:any,i:number)=>
    `- \`${String(i+1).padStart(2,'0')}-${u.id.split('/').pop()}.json\` — ${u.title} (${u.contentPoints.length} points)`
  ).join('\n');
  return `# ${d.subjectCode} — ${d.subjectName}

- Curriculum: \`${d.curriculumCode}\`
- Requested grade: \`${d.stage.requestedGrade}\`
- Official stage: \`${d.stage.id}\`
- Generated through the live MCP tool; not hand-authored.
- Runtime source of truth remains the live Skolverket-backed MCP/API path.
- Tutor-created exercises are not official Skolverket text.

## Units
${units}
`;
}

async function exportCatalog(label:string,specs:Spec[]){
  const base=join(root,'exports','family',label);
  rmSync(base,{recursive:true,force:true});
  const manifest:any[]=[];
  for(const spec of specs){
    process.stdout.write(`[${label}] ${spec.code} ${spec.stage} ... `);
    const text=await callTool({subjectCode:spec.code,stage:spec.stage,grade:spec.grade});
    const d=JSON.parse(text);
    if(d.subjectCode!==spec.code) throw new Error(`${spec.code}: returned ${d.subjectCode}`);
    if(d.stage?.id!==spec.stage) throw new Error(`${spec.code}: expected stage ${spec.stage}, got ${d.stage?.id}`);
    const sb=join(base,'subjects',spec.code,spec.stage);
    writeJson(join(sb,'teaching-context.json'),d);
    writeJson(join(sb,'index.json'),{
      subjectCode:d.subjectCode,subjectName:d.subjectName,curriculumCode:d.curriculumCode,
      stage:d.stage,
      units:d.units.map((u:any,i:number)=>({
        order:i+1,id:u.id,title:u.title,contentPointCount:u.contentPoints.length,
        file:`units/${String(i+1).padStart(2,'0')}-${u.id.split('/').pop()}.json`
      })),
      assessment:{year:d.stageAssessment.assessmentYear,file:`assessment/year-${d.stageAssessment.assessmentYear}.json`},
      provenance:d.provenance
    });
    d.units.forEach((u:any,i:number)=>writeJson(
      join(sb,'units',`${String(i+1).padStart(2,'0')}-${u.id.split('/').pop()}.json`),
      {subjectCode:d.subjectCode,subjectName:d.subjectName,curriculumCode:d.curriculumCode,
       stage:d.stage.id,requestedGrade:d.stage.requestedGrade,unit:u}
    ));
    writeJson(join(sb,'assessment',`year-${d.stageAssessment.assessmentYear}.json`),{
      subjectCode:d.subjectCode,subjectName:d.subjectName,curriculumCode:d.curriculumCode,
      stage:d.stage.id,assessment:d.stageAssessment
    });
    writeFileSync(join(sb,'README.md'),subjectReadme(d),'utf8');
    manifest.push({
      code:d.subjectCode,name:d.subjectName,stage:d.stage.id,requestedGrade:d.stage.requestedGrade,
      units:d.counts.units,contentPoints:d.counts.contentPoints,criteria:d.counts.criteria,
      path:`subjects/${d.subjectCode}/${d.stage.id}`
    });
    console.log(`${d.counts.units} units / ${d.counts.contentPoints} points`);
  }
  writeJson(join(base,'manifest.json'),{
    generatedBy:'scripts/export-family-curriculum.ts',
    catalog:label,
    subjects:manifest
  });
  return manifest;
}

async function main(){
  if(!existsSync(serverEntry)) throw new Error(`Missing ${serverEntry}; run npm run build first.`);

  const grade6=await exportCatalog('grade-6',GRADE6);
  const grade9=await exportCatalog('grade-9',GRADE9);

  const students=join(root,'exports','family','students');
  rmSync(students,{recursive:true,force:true});

  writeJson(join(students,'yara.json'),{
    student:'Yara',
    schoolGrade:6,
    curriculumCatalog:'../grade-6/manifest.json',
    regularTrack:true,
    reinforcementTrack:false,
    languageSubject:{
      status:'needs-confirmation',
      candidates:[
        {code:'GRGRSVE01',name:'Svenska'},
        {code:'GRGRSVA01',name:'Svenska som andraspråk'}
      ]
    },
    note:'No reinforcement track is configured. Use the school-confirmed Swedish subject when known.'
  });

  writeJson(join(students,'omar.json'),{
    student:'Omar',
    schoolGrade:9,
    curriculumCatalog:'../grade-9/manifest.json',
    regularTrack:true,
    languageSubject:{
      status:'needs-confirmation',
      candidates:[
        {code:'GRGRSVE01',name:'Svenska'},
        {code:'GRGRSVA01',name:'Svenska som andraspråk'}
      ],
      reinforcementTrack:{
        enabled:true,
        purpose:'Additional Swedish-language support for a newly arrived student alongside the regular class.',
        curriculumAuthority:'Uses the school-confirmed official Swedish subject; reinforcement is a teaching track, not assumed to be a separate Skolverket subject.'
      }
    }
  });

  writeJson(join(students,'esra.json'),{
    student:'Esra',
    schoolPlacement:'gymnasiet',
    curriculumSelection:'per-subject',
    recoveryCatalog:'../grade-9/manifest.json',
    activeSubjects:[],
    status:'needs-subject-list',
    note:'Do not treat Esra as ordinary Grade 9 or ordinary gymnasium. Activate Grundskola 7-9 curriculum only for the subjects she is still completing; gymnasium-level subjects, if any, must be configured separately from her actual individual study plan.'
  });

  writeJson(join(root,'exports','family','README.json'),{
    purpose:'Shared curriculum catalogs and student routing profiles.',
    catalogs:{
      grade6:{students:['Yara'],subjectCount:grade6.length},
      grade9:{students:['Omar','Esra (recovery catalog only)'],subjectCount:grade9.length}
    },
    designRule:'Curriculum data is shared by stage; student files select tracks and subjects without rewriting official content.'
  });
}

main().then(()=>process.exit(0)).catch(err=>{console.error(err);process.exit(1);});
