/**
 * Bulk-export the curriculum contexts used for Ali (Grade 5).
 *
 * Source of truth remains the live Skolverket-backed MCP tool.
 * This script calls get_tutor_teaching_context over stdio and writes
 * structured reference snapshots under exports/curriculum/.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const serverEntry = join(root, 'dist', 'index.js');

type ExportSpec = { code: string; stage: string; grade: number };

const SUBJECTS: ExportSpec[] = [
  { code: 'GRGRSVA01', stage: '4-6', grade: 5 },
  { code: 'GRGRMAT01', stage: '4-6', grade: 5 },
  { code: 'GRGRENG01', stage: '4-6', grade: 5 },
  { code: 'GRGRBIO01', stage: '4-6', grade: 5 },
  { code: 'GRGRFYS01', stage: '4-6', grade: 5 },
  { code: 'GRGRKEM01', stage: '4-6', grade: 5 },
  { code: 'GRGRTEK01', stage: '4-6', grade: 5 },
  { code: 'GRGRGEO01', stage: '4-6', grade: 5 },
  { code: 'GRGRHIS01', stage: '4-6', grade: 5 },
  { code: 'GRGRREL01', stage: '4-6', grade: 5 },
  { code: 'GRGRSAM01', stage: '4-6', grade: 5 },
  { code: 'GRGRBIL01', stage: '4-6', grade: 5 },
  { code: 'GRGRMUS01', stage: '4-6', grade: 5 },
  { code: 'GRGRSLJ01', stage: '4-6', grade: 5 },
  { code: 'GRGRIDR01', stage: '4-6', grade: 5 },
  // Skolverket publishes HKK central content for years 1-6, not 4-6.
  { code: 'GRGRHKK01', stage: '1-6', grade: 5 },
];

function callTool(args: Record<string, unknown>): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [serverEntry], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, LOG_LEVEL: 'error' },
    });
    let buf = '';
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error('Timeout: server did not respond within 60 seconds.'));
    }, 60_000);

    proc.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        let msg: any;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.id !== 2) continue;
        clearTimeout(timer);
        proc.kill();
        if (msg.error) return reject(new Error(msg.error.message));
        if (msg.result?.isError) return reject(new Error(msg.result.content[0].text));
        return resolve(msg.result.content[0].text);
      }
    });
    proc.on('error', reject);
    proc.stdin.write(JSON.stringify({
      jsonrpc:'2.0', id:1, method:'initialize',
      params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'bulk-export',version:'1'}}
    })+'\n');
    setTimeout(()=>proc.stdin.write(JSON.stringify({
      jsonrpc:'2.0', id:2, method:'tools/call',
      params:{name:'get_tutor_teaching_context',arguments:args}
    })+'\n'),400);
  });
}

function writeJson(path:string, value:unknown) {
  mkdirSync(dirname(path), {recursive:true});
  writeFileSync(path, JSON.stringify(value,null,2)+'\n','utf8');
}

function makeReadme(d:any) {
  const unitLines=d.units.map((u:any,i:number)=>
    `- \`${String(i+1).padStart(2,'0')}-${u.id.split('/').pop()}.json\` — ${u.title} (${u.contentPoints.length} points)`
  ).join('\n');
  return `# ${d.subjectCode} — ${d.subjectName} — Years ${d.stage.id}

Structured reference export generated through the production MCP path.

- Curriculum: \`${d.curriculumCode}\`
- Requested student grade: \`${d.stage.requestedGrade}\`
- Official central-content stage returned by Skolverket: \`${d.stage.id}\`
- These files are snapshots for inspection/reference. Runtime code must use the live MCP/API path.
- Tutor-created exercises are not official Skolverket text.
- Assessment criteria are stored separately and must not be presented as a current Grade-${d.stage.requestedGrade} judgment.

## Files

- \`teaching-context.json\` — complete normalized tool output
- \`index.json\` — compact manifest
- \`units/\` — one file per official content heading
- \`assessment/year-${d.stageAssessment.assessmentYear}.json\` — official assessment criteria returned with the context

## Units

${unitLines}
`;
}

async function exportOne(spec:ExportSpec) {
  const text=await callTool({subjectCode:spec.code,stage:spec.stage,grade:spec.grade});
  const d=JSON.parse(text);
  if (d.subjectCode!==spec.code) throw new Error(`${spec.code}: returned ${d.subjectCode}`);
  if (d.stage?.id!==spec.stage) throw new Error(`${spec.code}: expected stage ${spec.stage}, got ${d.stage?.id}`);
  if (d.stage?.requestedGrade!==spec.grade) throw new Error(`${spec.code}: expected grade ${spec.grade}, got ${d.stage?.requestedGrade}`);

  const base=join(root,'exports','curriculum',spec.code,spec.stage);
  rmSync(base,{recursive:true,force:true});
  writeJson(join(base,'teaching-context.json'),d);
  const units=d.units.map((u:any,i:number)=>({
    order:i+1,id:u.id,title:u.title,contentPointCount:u.contentPoints.length,
    file:`units/${String(i+1).padStart(2,'0')}-${u.id.split('/').pop()}.json`
  }));
  writeJson(join(base,'index.json'),{
    subjectCode:d.subjectCode,subjectName:d.subjectName,schoolType:d.schoolType,
    curriculumCode:d.curriculumCode,stage:d.stage,units,
    assessment:{year:d.stageAssessment.assessmentYear,file:`assessment/year-${d.stageAssessment.assessmentYear}.json`},
    provenance:d.provenance
  });
  d.units.forEach((u:any,i:number)=>writeJson(
    join(base,'units',`${String(i+1).padStart(2,'0')}-${u.id.split('/').pop()}.json`),
    {subjectCode:d.subjectCode,subjectName:d.subjectName,curriculumCode:d.curriculumCode,
     stage:d.stage.id,requestedGrade:d.stage.requestedGrade,unit:u}
  ));
  writeJson(join(base,'assessment',`year-${d.stageAssessment.assessmentYear}.json`),{
    subjectCode:d.subjectCode,subjectName:d.subjectName,curriculumCode:d.curriculumCode,
    stage:d.stage.id,assessment:d.stageAssessment
  });
  writeFileSync(join(base,'README.md'),makeReadme(d),'utf8');
  return {code:d.subjectCode,name:d.subjectName,stage:d.stage.id,
    units:d.counts.units,contentPoints:d.counts.contentPoints,criteria:d.counts.criteria};
}

async function main(){
  if(!existsSync(serverEntry)) throw new Error(`Missing ${serverEntry}; run npm run build first.`);
  const results=[];
  for(const s of SUBJECTS){
    process.stdout.write(`Exporting ${s.code} (${s.stage}) ... `);
    const r=await exportOne(s); results.push(r); console.log(`${r.units} units / ${r.contentPoints} points`);
  }
  writeJson(join(root,'exports','curriculum','grade-5-manifest.json'),{
    generatedBy:'scripts/export-ali-curriculum.ts',
    requestedGrade:5,
    note:'Subject-specific official stages are preserved; HKK uses 1-6 while the other listed subjects use 4-6.',
    subjects:results
  });
  console.log(`Exported ${results.length} subjects.`);
}
main().then(()=>process.exit(0)).catch(err=>{console.error(err);process.exit(1);});
