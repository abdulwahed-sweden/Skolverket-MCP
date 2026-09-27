/**
 * Exporterar den exakta utdata `get_tutor_teaching_context` ger, till en fil.
 *
 * Filen är till för inspektion och referens — den är INTE en andra sanningskälla.
 * Den byggs aldrig för hand: skriptet startar MCP-servern och gör ett riktigt
 * `tools/call` över stdio, så att det som hamnar på disk är exakt det en klient
 * får. Ändras verktyget ändras exporten vid nästa körning.
 *
 * Körs med:
 *   npm run build && npx tsx scripts/export-teaching-context.ts
 */

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const serverEntry = join(root, 'dist', 'index.js');

/** Vad som ska exporteras. Ett värde per fil, inga varianter. */
const EXPORTS = [
  {
    file: 'exports/GRGRSVA01-4-6.json',
    args: { subjectCode: 'GRGRSVA01', stage: '4-6', grade: 5 },
  },
];

function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [serverEntry], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, LOG_LEVEL: 'error' },
    });

    let buf = '';
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error('Timeout: servern svarade inte inom 60 s.'));
    }, 60_000);

    proc.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        let msg: any;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (msg.id !== 2) continue;
        clearTimeout(timer);
        proc.kill();
        if (msg.error) return reject(new Error(msg.error.message));
        if (msg.result?.isError) {
          return reject(new Error(msg.result.content[0].text));
        }
        return resolve(msg.result.content[0].text);
      }
    });

    proc.on('error', reject);

    proc.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'export-script', version: '1' },
        },
      }) + '\n'
    );
    setTimeout(() => {
      proc.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name, arguments: args },
        }) + '\n'
      );
    }, 400);
  });
}

async function main() {
  if (!existsSync(serverEntry)) {
    throw new Error(`Hittar inte ${serverEntry}. Kör \`npm run build\` först.`);
  }

  for (const { file, args } of EXPORTS) {
    process.stdout.write(`Exporterar ${file} … `);
    const text = await callTool('get_tutor_teaching_context', args);

    // Verifiera att vi fick det vi bad om innan något skrivs.
    const parsed = JSON.parse(text);
    if (parsed.subjectCode !== args.subjectCode) {
      throw new Error(
        `Fel ämne tillbaka: väntade ${args.subjectCode}, fick ${parsed.subjectCode}.`
      );
    }
    if (parsed.stage?.id !== args.stage) {
      throw new Error(`Fel stadium tillbaka: väntade ${args.stage}, fick ${parsed.stage?.id}.`);
    }

    const out = join(root, file);
    mkdirSync(dirname(out), { recursive: true });
    // Samma text som verktyget returnerade, omformaterad men oförändrad.
    writeFileSync(out, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
    console.log(
      `${parsed.subjectCode} ${parsed.stage.id}, årskurs ${parsed.stage.requestedGrade}, ` +
        `${parsed.counts.units} enheter / ${parsed.counts.contentPoints} punkter`
    );
  }
}

main()
  // Den avlivade serverprocessen kan hålla kvar handtag, så avsluta explicit
  // i stället för att vänta ut event-loopen.
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`Export misslyckades: ${err.message}`);
    process.exit(1);
  });
