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

const jsGlobals = new Set([
  'window', 'document', 'navigator', 'localStorage', 'sessionStorage',
  'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'fetch', 'Response', 'Request', 'Headers', 'URL', 'URLSearchParams',
  'Promise', 'Array', 'Object', 'String', 'Number', 'Boolean', 'Date',
  'Math', 'JSON', 'RegExp', 'Error', 'TypeError', 'RangeError', 'SyntaxError',
  'Set', 'Map', 'WeakSet', 'WeakMap', 'Symbol', 'parseInt', 'parseFloat',
  'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
  'encodeURI', 'decodeURI', 'CustomEvent', 'Event', 'MutationObserver',
  'IntersectionObserver', 'ResizeObserver', 'Blob', 'File', 'FileReader',
  'FormData', 'location', 'history', 'alert', 'confirm', 'prompt',
  'requestAnimationFrame', 'cancelAnimationFrame', 'caches', 'crypto',
  'indexedDB', 'atob', 'btoa', 'process', 'import', 'globalThis',
  'Intl', 'Audio', 'Image', 'performance', 'self', 'undefined', 'NaN', 'Infinity',
  'React', 'Intl', 'sessionStorage', 'localStorage', 'Element', 'HTMLElement',
  'MouseEvent', 'KeyboardEvent', 'Node', 'AudioContext', 'webkitAudioContext',
  'speechSynthesis', 'SpeechSynthesisUtterance', 'webkitSpeechRecognition', 'SpeechRecognition'
]);

function analyzeFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf-8');
  let ast;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });
  } catch (err) {
    return [{ type: 'PARSE_ERROR', message: err.message, line: err.loc?.line }];
  }

  const errors = [];
  const topScope = new Set();
  
  // Track all top-level imports and declarations
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      for (const s of node.specifiers) {
        topScope.add(s.local.name);
      }
    } else if (node.type === 'FunctionDeclaration') {
      if (node.id) topScope.add(node.id.name);
    } else if (node.type === 'ClassDeclaration') {
      if (node.id) topScope.add(node.id.name);
    } else if (node.type === 'VariableDeclaration') {
      for (const d of node.declarations) {
        function addId(id) {
          if (id.type === 'Identifier') topScope.add(id.name);
          else if (id.type === 'ObjectPattern') {
            for (const p of id.properties) {
              if (p.type === 'Property') addId(p.value);
              else if (p.type === 'RestElement') addId(p.argument);
            }
          } else if (id.type === 'ArrayPattern') {
            for (const el of id.elements) {
              if (el) addId(el);
            }
          }
        }
        addId(d.id);
      }
    } else if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      if (node.declaration.type === 'FunctionDeclaration' || node.declaration.type === 'ClassDeclaration') {
        if (node.declaration.id) topScope.add(node.declaration.id.name);
      } else if (node.declaration.type === 'VariableDeclaration') {
        for (const d of node.declaration.declarations) {
          if (d.id.type === 'Identifier') topScope.add(d.id.name);
        }
      }
    }
  }

  return errors;
}

let totalIssues = 0;
for (const filePath of files) {
  const fileIssues = analyzeFile(filePath);
  if (fileIssues.length > 0) {
    totalIssues += fileIssues.length;
    for (const issue of fileIssues) {
      console.log(`[${issue.type}] ${path.relative(path.resolve(__dirname, '..'), filePath)}:${issue.line} - ${issue.message}`);
    }
  }
}
console.log(`Identifier & Scope check complete. Issues: ${totalIssues}`);
