// Syntax-only check for *.pending.ts files whose imports cannot resolve yet.
// Usage: node tests/helpers/syntaxCheck.mjs <file.ts> [...]
import { readFileSync } from 'node:fs';
import ts from 'typescript';

let failed = 0;
for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, 'utf8');
  const out = ts.transpileModule(src, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const diags = out.diagnostics ?? [];
  if (diags.length) {
    failed += 1;
    for (const d of diags) {
      const { line, character } = d.file
        ? d.file.getLineAndCharacterOfPosition(d.start ?? 0)
        : { line: 0, character: 0 };
      console.error(`${file}:${line + 1}:${character + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
    }
  } else {
    console.log(`ok ${file}`);
  }
}
process.exit(failed ? 1 : 0);
