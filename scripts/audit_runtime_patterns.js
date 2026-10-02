import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../src');

function getAllFiles(dir, exts = ['.jsx']) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, exts));
    } else {
      const ext = path.extname(file);
      if (exts.includes(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

const files = getAllFiles(srcDir);
const findings = [];

for (const filePath of files) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // Pattern 1: Potential unsafe date parsing
    if (line.includes('new Date(') && !line.includes('Date.now()') && !line.includes('?') && !line.includes('||')) {
      // Check if it's new Date(variable) without null check
      const dateMatch = line.match(/new Date\(([a-zA-Z0-9_\.]+)\)/);
      if (dateMatch && !['Date.now()', '"', "'", '`'].some(k => dateMatch[1].startsWith(k))) {
        // flag for review if it's in a render path
      }
    }

    // Pattern 2: dangerous .toLowerCase() or .trim() on nullable fields
    if (/(?:email|name|title|search|query|role|category|status)\.(?:toLowerCase|toUpperCase|trim)\(/.test(line)) {
      if (!line.includes('?.') && !line.includes('String(') && !line.includes('|| ""') && !line.includes('&&')) {
        findings.push({
          file: filePath,
          line: lineNum,
          type: 'UNSAFE_STRING_METHOD',
          code: line.trim()
        });
      }
    }

    // Pattern 3: JSON.parse without try-catch or null check
    if (line.includes('JSON.parse(') && !line.includes('try') && !line.includes('catch')) {
      findings.push({
        file: filePath,
        line: lineNum,
        type: 'UNGUARDED_JSON_PARSE',
        code: line.trim()
      });
    }
  });
}

console.log(`Total pattern findings: ${findings.length}`);
findings.forEach(f => {
  console.log(`[${f.type}] ${path.relative(srcDir, f.file)}:${f.line} -> ${f.code}`);
});
