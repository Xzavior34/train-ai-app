import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from '../node_modules/@babel/parser/lib/index.js';
import * as LucideIcons from 'lucide-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../src');

function getAllFiles(dir, exts = ['.js', '.jsx', '.ts', '.tsx']) {
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
console.log(`Found ${files.length} files in src/`);

const issues = [];

for (const filePath of files) {
  const code = fs.readFileSync(filePath, 'utf-8');
  let ast;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });
  } catch (err) {
    issues.push({
      file: filePath,
      type: 'SYNTAX_ERROR',
      message: err.message,
      line: err.loc?.line
    });
    continue;
  }

  // Check imports
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      const importSource = node.source.value;
      if (importSource.startsWith('.')) {
        const resolvedBase = path.resolve(path.dirname(filePath), importSource);
        let exists = false;
        const candidates = [
          resolvedBase,
          resolvedBase + '.js',
          resolvedBase + '.jsx',
          resolvedBase + '.ts',
          resolvedBase + '.tsx',
          path.join(resolvedBase, 'index.js'),
          path.join(resolvedBase, 'index.jsx'),
          path.join(resolvedBase, 'index.ts'),
          path.join(resolvedBase, 'index.tsx'),
          resolvedBase + '.css'
        ];
        for (const c of candidates) {
          if (fs.existsSync(c)) {
            exists = true;
            break;
          }
        }
        if (!exists) {
          issues.push({
            file: filePath,
            type: 'BROKEN_LOCAL_IMPORT',
            message: `Cannot resolve import "${importSource}" from ${filePath}`,
            line: node.loc?.start.line
          });
        }
      } else if (importSource === 'lucide-react') {
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportSpecifier') {
            const importedName = specifier.imported.name;
            if (!LucideIcons[importedName]) {
              issues.push({
                file: filePath,
                type: 'INVALID_LUCIDE_ICON',
                message: `Icon "${importedName}" does not exist in lucide-react`,
                line: specifier.loc?.start.line
              });
            }
          }
        }
      }
    }
  }
}

console.log(`\nScan complete. Total issues found: ${issues.length}`);
for (const issue of issues) {
  console.log(`[${issue.type}] ${path.relative(path.resolve(__dirname, '..'), issue.file)}:${issue.line} - ${issue.message}`);
}
