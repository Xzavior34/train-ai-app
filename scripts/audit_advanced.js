import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from '../node_modules/@babel/parser/lib/index.js';

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
const fileExports = new Map();
const fileASTs = new Map();

// Pass 1: Parse all files and record exports
for (const filePath of files) {
  const code = fs.readFileSync(filePath, 'utf-8');
  try {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });
    fileASTs.set(filePath, { ast, code });
    
    const exports = new Set();
    let hasDefaultExport = false;

    for (const node of ast.program.body) {
      if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
          if (node.declaration.type === 'FunctionDeclaration' || node.declaration.type === 'ClassDeclaration') {
            if (node.declaration.id) exports.add(node.declaration.id.name);
          } else if (node.declaration.type === 'VariableDeclaration') {
            for (const decl of node.declaration.declarations) {
              if (decl.id.type === 'Identifier') exports.add(decl.id.name);
            }
          }
        }
        for (const spec of node.specifiers || []) {
          if (spec.exported) exports.add(spec.exported.name);
        }
      } else if (node.type === 'ExportDefaultDeclaration') {
        hasDefaultExport = true;
      }
    }
    fileExports.set(filePath, { exports, hasDefaultExport });
  } catch (err) {
    console.error(`Error parsing ${filePath}:`, err.message);
  }
}

function resolveFilePath(fromFile, importSource) {
  if (!importSource.startsWith('.')) return null;
  const resolvedBase = path.resolve(path.dirname(fromFile), importSource);
  const candidates = [
    resolvedBase,
    resolvedBase + '.js',
    resolvedBase + '.jsx',
    resolvedBase + '.ts',
    resolvedBase + '.tsx',
    path.join(resolvedBase, 'index.js'),
    path.join(resolvedBase, 'index.jsx'),
    path.join(resolvedBase, 'index.ts'),
    path.join(resolvedBase, 'index.tsx')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return c;
    }
  }
  return null;
}

const issues = [];

// Pass 2: Check imported names against exported names
for (const [filePath, { ast }] of fileASTs.entries()) {
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      const targetFile = resolveFilePath(filePath, node.source.value);
      if (targetFile && fileExports.has(targetFile)) {
        const { exports, hasDefaultExport } = fileExports.get(targetFile);
        for (const spec of node.specifiers) {
          if (spec.type === 'ImportSpecifier') {
            const importedName = spec.imported.name;
            if (!exports.has(importedName)) {
              issues.push({
                file: filePath,
                type: 'UNRESOLVED_EXPORT',
                message: `"${importedName}" is imported from "${node.source.value}" (${path.relative(srcDir, targetFile)}) but is not exported!`,
                line: spec.loc?.start.line
              });
            }
          } else if (spec.type === 'ImportDefaultSpecifier') {
            if (!hasDefaultExport) {
              issues.push({
                file: filePath,
                type: 'MISSING_DEFAULT_EXPORT',
                message: `Default export is imported from "${node.source.value}" (${path.relative(srcDir, targetFile)}) but it has NO default export!`,
                line: spec.loc?.start.line
              });
            }
          }
        }
      }
    }
  }
}

console.log(`\nImport/Export Audit complete. Total issues found: ${issues.length}`);
for (const issue of issues) {
  console.log(`[${issue.type}] ${path.relative(path.resolve(__dirname, '..'), issue.file)}:${issue.line} - ${issue.message}`);
}
